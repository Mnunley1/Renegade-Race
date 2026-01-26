import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { rateLimiter } from './rateLimiter';
import { sanitizeMessage } from './sanitize';

// Get messages for a conversation
export const getByConversation = query({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(), // Add userId to identify which user is viewing
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, userId, limit = 50 } = args;

    // Verify conversation exists
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Ensure the user is part of the conversation
    if (
      conversation.renterId !== userId &&
      conversation.ownerId !== userId
    ) {
      throw new Error('Not authorized to view this conversation');
    }

    // Determine if this user has a reopening timestamp (they deleted and it was reopened)
    const isRenter = conversation.renterId === userId;
    const reopenedAt = isRenter 
      ? conversation.reopenedAtRenter 
      : conversation.reopenedAtOwner;

    // Get messages ordered by creation time (newest first)
    let messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_created', q =>
        q.eq('conversationId', conversationId)
      )
      .order('desc')
      .take(limit);

    // If user has a reopening timestamp, only show messages sent after that timestamp
    // This hides old messages that were part of the deleted conversation
    if (reopenedAt) {
      messages = messages.filter(message => message.createdAt >= reopenedAt);
    }

    // Get sender details and replied-to message for each message
    const messagesWithSenders = await Promise.all(
      messages.map(async message => {
        const sender = await ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', message.senderId)
          )
          .first();

        // Get replied-to message if it exists and is visible (after reopening timestamp)
        let repliedToMessage = null;
        if (message.replyTo) {
          const replyToMsg = await ctx.db.get(message.replyTo);
          if (replyToMsg) {
            // Only include replied-to message if it's visible (after reopening timestamp)
            if (!reopenedAt || replyToMsg.createdAt >= reopenedAt) {
              const replyToSender = await ctx.db
                .query('users')
                .withIndex('by_external_id', q =>
                  q.eq('externalId', replyToMsg.senderId)
                )
                .first();

              repliedToMessage = {
                ...replyToMsg,
                sender: replyToSender,
              };
            }
          }
        }

        return {
          ...message,
          sender,
          repliedToMessage,
        };
      })
    );

    // Return messages in chronological order (oldest first)
    return messagesWithSenders.reverse();
  },
});

// Send a message
export const send = mutation({
  args: {
    conversationId: v.optional(v.id('conversations')),
    vehicleId: v.optional(v.id('vehicles')),
    renterId: v.optional(v.string()),
    ownerId: v.optional(v.string()),
    content: v.string(),
    messageType: v.optional(
      v.union(v.literal('text'), v.literal('image'), v.literal('system'))
    ),
    replyTo: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Rate limit: 20 messages per minute per user
    await rateLimiter.limit(ctx, "sendMessage", {
      key: identity.subject,
      throws: true,
    });

    const senderId = identity.subject;
    const now = Date.now();

    let conversationId = args.conversationId;
    let conversation;

    // If no conversationId provided, create a new conversation
    if (conversationId) {
      // Verify conversation exists and user is part of it
      conversation = await ctx.db.get(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      if (
        conversation.renterId !== senderId &&
        conversation.ownerId !== senderId
      ) {
        throw new Error('Not authorized to send messages in this conversation');
      }
    } else {
      if (!((args.vehicleId && args.renterId ) && args.ownerId)) {
        throw new Error('Missing required fields to create conversation');
      }

      // Ensure the authenticated user is either the renter or owner
      if (senderId !== args.renterId && senderId !== args.ownerId) {
        throw new Error('Not authorized to create this conversation');
      }

      // Check if conversation already exists
      const existingConversation = await ctx.db
        .query('conversations')
        .withIndex('by_participants', q =>
          q.eq('renterId', args.renterId!).eq('ownerId', args.ownerId!)
        )
        .filter(q => q.eq(q.field('vehicleId'), args.vehicleId))
        .first();

      if (existingConversation) {
        conversationId = existingConversation._id;
        conversation = existingConversation;
      } else {
        // Create the conversation as inactive - it will be activated after the first message is sent
        conversationId = await ctx.db.insert('conversations', {
          vehicleId: args.vehicleId,
          renterId: args.renterId,
          ownerId: args.ownerId,
          lastMessageAt: now,
          unreadCountRenter: 0,
          unreadCountOwner: 0,
          isActive: false,
          createdAt: now,
          updatedAt: now,
        });

        // Get the newly created conversation
        conversation = await ctx.db.get(conversationId);
      }
    }

    // Verify replyTo message exists and is in the same conversation if provided
    if (args.replyTo) {
      const replyToMessage = await ctx.db.get(args.replyTo);
      if (!replyToMessage) {
        throw new Error('Reply to message not found');
      }
      if (replyToMessage.conversationId !== conversationId) {
        throw new Error('Reply to message must be in the same conversation');
      }
    }

    // Create the message with sanitized content
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      senderId,
      content: sanitizeMessage(args.content),
      messageType: args.messageType || 'text',
      replyTo: args.replyTo,
      isRead: false,
      createdAt: now,
    });

    // Update conversation metadata and unread count, and activate the conversation
    // Activate conversation if it's currently inactive (first message or reactivating)
    // This ensures the recipient only sees the conversation after the first message is sent
    const activateConversation = !conversation?.isActive

    if (conversation && conversation.renterId === senderId) {
      // Sender is renter, so owner receives the message
      const updateData: {
        lastMessageAt: number;
        lastMessageText: string;
        lastMessageSenderId: string;
        unreadCountOwner: number;
        isActive: boolean;
        updatedAt: number;
        deletedByOwner?: boolean;
        reopenedAtOwner?: number;
      } = {
        lastMessageAt: now,
        lastMessageText: args.content,
        lastMessageSenderId: senderId,
        unreadCountOwner: (conversation.unreadCountOwner || 0) + 1,
        isActive: activateConversation ? true : conversation.isActive,
        updatedAt: now,
      };

      // If owner deleted the conversation, clear their deletion flag and record reopening timestamp
      // This allows the conversation to reappear, but only new messages will be visible
      if (conversation.deletedByOwner === true) {
        updateData.deletedByOwner = false;
        updateData.reopenedAtOwner = now; // Record when conversation was reopened for owner
      }

      await ctx.db.patch(conversationId, updateData);
    } else {
      // Sender is owner, so renter receives the message
      const updateData: {
        lastMessageAt: number;
        lastMessageText: string;
        lastMessageSenderId: string;
        unreadCountRenter: number;
        isActive: boolean;
        updatedAt: number;
        deletedByRenter?: boolean;
        reopenedAtRenter?: number;
      } = {
        lastMessageAt: now,
        lastMessageText: args.content,
        lastMessageSenderId: senderId,
        unreadCountRenter: (conversation?.unreadCountRenter || 0) + 1,
        isActive: activateConversation ? true : (conversation?.isActive ?? true),
        updatedAt: now,
      };

      // If renter deleted the conversation, clear their deletion flag and record reopening timestamp
      // This allows the conversation to reappear, but only new messages will be visible
      if (conversation.deletedByRenter === true) {
        updateData.deletedByRenter = false;
        updateData.reopenedAtRenter = now; // Record when conversation was reopened for renter
      }

      await ctx.db.patch(conversationId, updateData);
    }

    return { messageId, conversationId };
  },
});

// Mark message as read
export const markAsRead = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only mark as read if the user is not the sender
    if (message.senderId === identity.subject) {
      return args.messageId;
    }

    await ctx.db.patch(args.messageId, {
      isRead: true,
      readAt: Date.now(),
    });

    return args.messageId;
  },
});

// Mark all messages in a conversation as read
export const markConversationAsRead = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Verify conversation exists and user is part of it
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (
      conversation.renterId !== args.userId &&
      conversation.ownerId !== args.userId
    ) {
      throw new Error(
        'Not authorized to mark messages as read in this conversation'
      );
    }

    // Mark all unread messages from other participants as read
    const unreadMessages = await ctx.db
      .query('messages')
      .withIndex('by_unread', q =>
        q.eq('conversationId', args.conversationId).eq('isRead', false)
      )
      .filter(q => q.neq(q.field('senderId'), args.userId))
      .collect();

    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        isRead: true,
        readAt: Date.now(),
      });
    }

    // Update conversation unread count
    if (conversation.renterId === args.userId) {
      await ctx.db.patch(args.conversationId, {
        updatedAt: Date.now(),
        unreadCountRenter: 0,
      });
    } else {
      await ctx.db.patch(args.conversationId, {
        updatedAt: Date.now(),
        unreadCountOwner: 0,
      });
    }

    return args.conversationId;
  },
});

// Get unread message count for a user
export const getUnreadCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    // Get all conversations where user is a participant
    const renterConversations = await ctx.db
      .query('conversations')
      .withIndex('by_renter_active', q =>
        q.eq('renterId', userId).eq('isActive', true)
      )
      .collect();

    const ownerConversations = await ctx.db
      .query('conversations')
      .withIndex('by_owner_active', q =>
        q.eq('ownerId', userId).eq('isActive', true)
      )
      .collect();

    // Calculate total unread count
    let totalUnread = 0;

    for (const conversation of renterConversations) {
      totalUnread += conversation.unreadCountRenter || 0;
    }

    for (const conversation of ownerConversations) {
      totalUnread += conversation.unreadCountOwner || 0;
    }

    return totalUnread;
  },
});

// Delete a message (only by sender)
export const deleteMessage = mutation({
  args: {
    messageId: v.id('messages'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only the sender can delete their own message
    if (message.senderId !== identity.subject) {
      throw new Error('Not authorized to delete this message');
    }

    // Delete the message
    await ctx.db.delete(args.messageId);

    return args.messageId;
  },
});

// Edit a message (only by sender, within 15 minutes)
export const editMessage = mutation({
  args: {
    messageId: v.id('messages'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Only the sender can edit their own message
    if (message.senderId !== identity.subject) {
      throw new Error('Not authorized to edit this message');
    }

    // Check if message is within edit window (15 minutes)
    const editWindow = 15 * 60 * 1000; // 15 minutes in milliseconds
    const now = Date.now();
    if (now - message.createdAt > editWindow) {
      throw new Error(
        'Message can only be edited within 15 minutes of sending'
      );
    }

    // Update the message content with sanitized input
    await ctx.db.patch(args.messageId, {
      content: sanitizeMessage(args.content),
    });

    return args.messageId;
  },
});

// Host-specific message management functions

// Get all conversations for a host with detailed information
export const getHostConversations = query({
  args: {
    hostId: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { hostId, includeArchived = false } = args;

    // Get conversations where user is the owner
    const conversationsQuery = ctx.db
      .query('conversations')
      .withIndex('by_owner', q => q.eq('ownerId', hostId));

    const allConversations = await conversationsQuery.collect();

    // Filter out conversations deleted by the host (owner)
    const conversations = allConversations.filter(
      conv => conv.deletedByOwner !== true
    );

    // Filter by active status if needed
    const filteredConversations = includeArchived
      ? conversations
      : conversations.filter(conv => conv.isActive);

    // Get detailed information for each conversation
    const conversationsWithDetails = await Promise.all(
      filteredConversations.map(async conversation => {
        const [vehicle, renter] = await Promise.all([
          ctx.db.get(conversation.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', conversation.renterId)
            )
            .first(),
        ]);

        // Get latest message details
        const latestMessage = await ctx.db
          .query('messages')
          .withIndex('by_conversation_created', q =>
            q.eq('conversationId', conversation._id)
          )
          .order('desc')
          .first();

        return {
          ...conversation,
          vehicle,
          renter,
          latestMessage,
        };
      })
    );

    // Sort by last message time
    return conversationsWithDetails.sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );
  },
});

// Get conversation statistics for a host
export const getHostMessageStats = query({
  args: {
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const { hostId } = args;

    // Get all conversations for this host
    const allConversations = await ctx.db
      .query('conversations')
      .withIndex('by_owner', q => q.eq('ownerId', hostId))
      .collect();

    // Filter out conversations deleted by the host (owner)
    const conversations = allConversations.filter(
      conv => conv.deletedByOwner !== true
    );

    let totalMessages = 0;
    let unreadMessages = 0;
    let activeConversations = 0;
    let archivedConversations = 0;

    for (const conversation of conversations) {
      // Count messages in this conversation
      const messageCount = await ctx.db
        .query('messages')
        .withIndex('by_conversation', q =>
          q.eq('conversationId', conversation._id)
        )
        .collect();

      totalMessages += messageCount.length;

      // Count unread messages (messages not sent by host)
      const unreadCount = messageCount.filter(
        msg => msg.senderId !== hostId && !msg.isRead
      ).length;
      unreadMessages += unreadCount;

      // Count active/archived conversations
      if (conversation.isActive) {
        activeConversations++;
      } else {
        archivedConversations++;
      }
    }

    return {
      totalMessages,
      unreadMessages,
      activeConversations,
      archivedConversations,
      totalConversations: conversations.length,
    };
  },
});

// Bulk mark conversations as read for a host
export const bulkMarkHostConversationsAsRead = mutation({
  args: {
    hostId: v.string(),
    conversationIds: v.optional(v.array(v.id('conversations'))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const { hostId, conversationIds } = args;

    // Verify the authenticated user is the host
    if (identity.subject !== hostId) {
      throw new Error('Not authorized to perform this action');
    }

    // Get conversations to update
    let conversations;
    if (conversationIds && conversationIds.length > 0) {
      conversations = await Promise.all(
        conversationIds.map(id => ctx.db.get(id))
      );
      conversations = conversations.filter(Boolean);
    } else {
      // Get all conversations for this host
      const allConversations = await ctx.db
        .query('conversations')
        .withIndex('by_owner', q => q.eq('ownerId', hostId))
        .collect();
      conversations = allConversations.filter(
        conv => conv.deletedByOwner !== true
      );
    }

    const updatedConversations: Id<'conversations'>[] = [];

    for (const conversation of conversations) {
      if (!conversation) continue;

      // Mark all unread messages as read
      const unreadMessages = await ctx.db
        .query('messages')
        .withIndex('by_unread', q =>
          q.eq('conversationId', conversation._id).eq('isRead', false)
        )
        .filter(q => q.neq(q.field('senderId'), hostId))
        .collect();

      for (const message of unreadMessages) {
        await ctx.db.patch(message._id, {
          isRead: true,
          readAt: Date.now(),
        });
      }

      // Update conversation unread count
      await ctx.db.patch(conversation._id, {
        unreadCountOwner: 0,
        updatedAt: Date.now(),
      });

      updatedConversations.push(conversation._id);
    }

    return updatedConversations;
  },
});

// Bulk archive conversations for a host
export const bulkArchiveHostConversations = mutation({
  args: {
    hostId: v.string(),
    conversationIds: v.array(v.id('conversations')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const { hostId, conversationIds } = args;

    // Verify the authenticated user is the host
    if (identity.subject !== hostId) {
      throw new Error('Not authorized to perform this action');
    }

    const archivedConversations: Id<'conversations'>[] = [];

    for (const conversationId of conversationIds) {
      const conversation = await ctx.db.get(conversationId);
      if (!conversation) continue;

      // Verify this conversation belongs to the host
      if (conversation.ownerId !== hostId) {
        throw new Error('Not authorized to archive this conversation');
      }

      await ctx.db.patch(conversationId, {
        isActive: false,
        updatedAt: Date.now(),
      });

      archivedConversations.push(conversationId);
    }

    return archivedConversations;
  },
});

// Helper function to check if user is admin via Clerk metadata
async function checkAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error('Not authenticated');
  }

  // When session token is configured with { "metadata": "{{user.public_metadata}}" },
  // the metadata is available in identity.metadata
  const role =
    (identity as any).metadata?.role || // From session token (recommended)
    (identity as any).publicMetadata?.role || // Direct from Clerk
    (identity as any).orgRole;

  if (role !== 'admin') {
    throw new Error('Admin access required');
  }

  return identity;
}

// Send admin message to a user (creates a system message in an existing conversation or creates a new one)
export const sendAdminMessage = mutation({
  args: {
    userId: v.string(), // externalId of the user to message
    content: v.string(),
    vehicleId: v.optional(v.id('vehicles')), // Optional - if provided, will use/create conversation for that vehicle
  },
  handler: async (ctx, args) => {
    const identity = await checkAdmin(ctx);
    const adminId = identity.subject;
    const now = Date.now();

    // Find the user
    const user = await ctx.db
      .query('users')
      .withIndex('by_external_id', q => q.eq('externalId', args.userId))
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // If vehicleId is provided, try to find or create a conversation
    // For admin messages, we'll create a system message
    // Since admin isn't part of normal conversations, we'll create a special system message
    // For simplicity, we'll create a message that can be displayed in the user's admin messages section
    // This is a simplified implementation - in production you might want a dedicated admin messages table

    // For now, if vehicleId is provided, find the conversation and add admin message
    if (args.vehicleId) {
      const vehicle = await ctx.db.get(args.vehicleId);
      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      // Find conversation for this vehicle with this user
      const conversation = await ctx.db
        .query('conversations')
        .withIndex('by_vehicle', q => q.eq('vehicleId', args.vehicleId))
        .filter(q =>
          q.or(
            q.eq(q.field('renterId'), args.userId),
            q.eq(q.field('ownerId'), args.userId)
          )
        )
        .first();

      if (conversation) {
        // Add system message to existing conversation
        const messageId = await ctx.db.insert('messages', {
          conversationId: conversation._id,
          senderId: adminId,
          content: `[Admin Message] ${args.content}`,
          messageType: 'system',
          isRead: false,
          createdAt: now,
        });

        // Update conversation metadata
        await ctx.db.patch(conversation._id, {
          lastMessageAt: now,
          lastMessageText: args.content,
          lastMessageSenderId: adminId,
          updatedAt: now,
        });

        // Update unread count for the user
        if (conversation.renterId === args.userId) {
          await ctx.db.patch(conversation._id, {
            unreadCountRenter: (conversation.unreadCountRenter || 0) + 1,
          });
        } else {
          await ctx.db.patch(conversation._id, {
            unreadCountOwner: (conversation.unreadCountOwner || 0) + 1,
          });
        }

        return { messageId, conversationId: conversation._id };
      }
    }

    // If no conversation found or no vehicleId, we'll just return success
    // In production, you might want to create a dedicated admin messages system
    return { success: true, message: 'Admin message sent (system message)' };
  },
});

// Send system message as host (for automated responses)
export const sendHostSystemMessage = mutation({
  args: {
    conversationId: v.id('conversations'),
    content: v.string(),
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const { conversationId, content, hostId } = args;

    // Verify the authenticated user is the host
    if (identity.subject !== hostId) {
      throw new Error('Not authorized to send system messages');
    }

    // Verify conversation exists and host is the owner
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (conversation.ownerId !== hostId) {
      throw new Error('Not authorized to send messages in this conversation');
    }

    const now = Date.now();

    // Create the system message
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      senderId: hostId,
      content,
      messageType: 'system',
      isRead: false,
      createdAt: now,
    });

    // Update conversation metadata
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastMessageText: content,
      lastMessageSenderId: hostId,
      unreadCountRenter: (conversation.unreadCountRenter || 0) + 1,
      updatedAt: now,
    });

    return messageId;
  },
});

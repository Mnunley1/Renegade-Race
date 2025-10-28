import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

// Get messages for a conversation
export const getByConversation = query({
  args: {
    conversationId: v.id('conversations'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { conversationId, limit = 50 } = args;

    // Verify conversation exists
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Get messages ordered by creation time (newest first)
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation_created', q =>
        q.eq('conversationId', conversationId)
      )
      .order('desc')
      .take(limit);

    // Get sender details for each message
    const messagesWithSenders = await Promise.all(
      messages.map(async message => {
        const sender = await ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', message.senderId)
          )
          .first();

        return {
          ...message,
          sender,
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

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
        // Create the conversation
        conversationId = await ctx.db.insert('conversations', {
          vehicleId: args.vehicleId,
          renterId: args.renterId,
          ownerId: args.ownerId,
          lastMessageAt: now,
          unreadCountRenter: 0,
          unreadCountOwner: 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        // Get the newly created conversation
        conversation = await ctx.db.get(conversationId);
      }
    }

    // Create the message
    const messageId = await ctx.db.insert('messages', {
      conversationId,
      senderId,
      content: args.content,
      messageType: args.messageType || 'text',
      isRead: false,
      createdAt: now,
    });

    // Update conversation metadata and unread count
    if (conversation && conversation.renterId === senderId) {
      await ctx.db.patch(conversationId, {
        lastMessageAt: now,
        lastMessageText: args.content,
        lastMessageSenderId: senderId,
        unreadCountOwner: (conversation.unreadCountOwner || 0) + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(conversationId, {
        lastMessageAt: now,
        lastMessageText: args.content,
        lastMessageSenderId: senderId,
        unreadCountRenter: (conversation?.unreadCountRenter || 0) + 1,
        updatedAt: now,
      });
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

    // Update the message content
    await ctx.db.patch(args.messageId, {
      content: args.content,
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

    const conversations = await conversationsQuery.collect();

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
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_owner', q => q.eq('ownerId', hostId))
      .collect();

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
      conversations = await ctx.db
        .query('conversations')
        .withIndex('by_owner', q => q.eq('ownerId', hostId))
        .collect();
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

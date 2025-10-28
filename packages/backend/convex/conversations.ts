import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get conversations for a user (as renter or owner)
export const getByUser = query({
  args: {
    userId: v.string(),
    role: v.union(v.literal('renter'), v.literal('owner')),
  },
  handler: async (ctx, args) => {
    const { userId, role } = args;

    let conversationsQuery;
    if (role === 'renter') {
      conversationsQuery = ctx.db
        .query('conversations')
        .withIndex('by_renter_active', q =>
          q.eq('renterId', userId).eq('isActive', true)
        );
    } else {
      conversationsQuery = ctx.db
        .query('conversations')
        .withIndex('by_owner_active', q =>
          q.eq('ownerId', userId).eq('isActive', true)
        );
    }

    const conversations = await conversationsQuery.order('desc').collect();

    // Get vehicle and user details
    const conversationsWithDetails = await Promise.all(
      conversations.map(async conversation => {
        const [vehicle, renter, owner] = await Promise.all([
          ctx.db.get(conversation.vehicleId),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', conversation.renterId)
            )
            .first(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', conversation.ownerId)
            )
            .first(),
        ]);

        return {
          ...conversation,
          vehicle,
          renter,
          owner,
        };
      })
    );

    return conversationsWithDetails;
  },
});

// Get a specific conversation by ID
export const getById = query({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const [vehicle, renter, owner] = await Promise.all([
      ctx.db.get(conversation.vehicleId),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', conversation.renterId)
        )
        .first(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', conversation.ownerId)
        )
        .first(),
    ]);

    return {
      ...conversation,
      vehicle,
      renter,
      owner,
    };
  },
});

// Get conversation by vehicle and participants
export const getByVehicleAndParticipants = query({
  args: {
    vehicleId: v.id('vehicles'),
    renterId: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query('conversations')
      .withIndex('by_participants', q =>
        q.eq('renterId', args.renterId).eq('ownerId', args.ownerId)
      )
      .filter(q => q.eq(q.field('vehicleId'), args.vehicleId))
      .first();

    if (!conversation) {
      return null;
    }

    const [vehicle, renter, owner] = await Promise.all([
      ctx.db.get(conversation.vehicleId),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', conversation.renterId)
        )
        .first(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q =>
          q.eq('externalId', conversation.ownerId)
        )
        .first(),
    ]);

    return {
      ...conversation,
      vehicle,
      renter,
      owner,
    };
  },
});

// Create a new conversation
export const create = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    renterId: v.string(),
    ownerId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;

    // Ensure the authenticated user is either the renter or owner
    if (userId !== args.renterId && userId !== args.ownerId) {
      throw new Error('Not authorized to create this conversation');
    }

    // Check if conversation already exists
    const existingConversation = await ctx.db
      .query('conversations')
      .withIndex('by_participants', q =>
        q.eq('renterId', args.renterId).eq('ownerId', args.ownerId)
      )
      .filter(q => q.eq(q.field('vehicleId'), args.vehicleId))
      .first();

    if (existingConversation) {
      return existingConversation._id;
    }

    const now = Date.now();

    // Create the conversation
    const conversationId = await ctx.db.insert('conversations', {
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

    return conversationId;
  },
});

// Mark conversation as read
export const markAsRead = mutation({
  args: {
    conversationId: v.id('conversations'),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Ensure the user is part of the conversation
    if (
      conversation.renterId !== args.userId &&
      conversation.ownerId !== args.userId
    ) {
      throw new Error('Not authorized to mark this conversation as read');
    }

    // Update unread count based on user role
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

    // Mark all unread messages as read
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

    return args.conversationId;
  },
});

// Archive conversation (soft delete)
export const archive = mutation({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Ensure the user is part of the conversation
    if (
      conversation.renterId !== identity.subject &&
      conversation.ownerId !== identity.subject
    ) {
      throw new Error('Not authorized to archive this conversation');
    }

    await ctx.db.patch(args.conversationId, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return args.conversationId;
  },
});

// Delete conversation and all its messages (hard delete)
export const deleteConversation = mutation({
  args: {
    conversationId: v.id('conversations'),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Ensure the user is part of the conversation
    if (
      conversation.renterId !== identity.subject &&
      conversation.ownerId !== identity.subject
    ) {
      throw new Error('Not authorized to delete this conversation');
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_conversation', q =>
        q.eq('conversationId', args.conversationId)
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);

    return args.conversationId;
  },
});

// Host-specific conversation management functions

// Get conversations by vehicle for a host
export const getHostConversationsByVehicle = query({
  args: {
    hostId: v.string(),
    vehicleId: v.id('vehicles'),
  },
  handler: async (ctx, args) => {
    const { hostId, vehicleId } = args;

    // Get conversations for this vehicle where user is the owner
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_vehicle', q => q.eq('vehicleId', vehicleId))
      .filter(q => q.eq(q.field('ownerId'), hostId))
      .collect();

    // Get detailed information for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations.map(async conversation => {
        const renter = await ctx.db
          .query('users')
          .withIndex('by_external_id', q =>
            q.eq('externalId', conversation.renterId)
          )
          .first();

        return {
          ...conversation,
          renter,
        };
      })
    );

    return conversationsWithDetails.sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );
  },
});

// Get conversation analytics for a host
export const getHostConversationAnalytics = query({
  args: {
    hostId: v.string(),
    timeRange: v.optional(
      v.union(
        v.literal('7d'),
        v.literal('30d'),
        v.literal('90d'),
        v.literal('1y')
      )
    ),
  },
  handler: async (ctx, args) => {
    const { hostId, timeRange = '30d' } = args;

    // Calculate time threshold
    const now = Date.now();
    let timeThreshold = now;

    switch (timeRange) {
      case '7d':
        timeThreshold = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '90d':
        timeThreshold = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case '1y':
        timeThreshold = now - 365 * 24 * 60 * 60 * 1000;
        break;
    }

    // Get all conversations for this host
    const conversations = await ctx.db
      .query('conversations')
      .withIndex('by_owner', q => q.eq('ownerId', hostId))
      .collect();

    // Filter conversations by time range
    const recentConversations = conversations.filter(
      conv => conv.createdAt >= timeThreshold
    );

    // Calculate analytics
    const totalConversations = recentConversations.length;
    const activeConversations = recentConversations.filter(
      conv => conv.isActive
    ).length;
    const archivedConversations = recentConversations.filter(
      conv => !conv.isActive
    ).length;

    // Calculate response time metrics
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const conversation of recentConversations) {
      // Get messages in this conversation
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_conversation_created', q =>
          q.eq('conversationId', conversation._id)
        )
        .order('asc')
        .collect();

      // Calculate response times
      for (let i = 0; i < messages.length - 1; i++) {
        const currentMessage = messages[i];
        const nextMessage = messages[i + 1];

        // If current message is from renter and next is from host
        if (
          currentMessage.senderId !== hostId &&
          nextMessage.senderId === hostId
        ) {
          const responseTime = nextMessage.createdAt - currentMessage.createdAt;
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
    }

    const averageResponseTime =
      responseCount > 0
        ? Math.round(totalResponseTime / responseCount / (1000 * 60)) // Convert to minutes
        : 0;

    return {
      totalConversations,
      activeConversations,
      archivedConversations,
      averageResponseTimeMinutes: averageResponseTime,
      responseCount,
      timeRange,
    };
  },
});

// Bulk operations for host conversations
export const bulkHostConversationActions = mutation({
  args: {
    hostId: v.string(),
    conversationIds: v.array(v.id('conversations')),
    action: v.union(
      v.literal('archive'),
      v.literal('unarchive'),
      v.literal('mark_read'),
      v.literal('delete')
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const { hostId, conversationIds, action } = args;

    // Verify the authenticated user is the host
    if (identity.subject !== hostId) {
      throw new Error('Not authorized to perform this action');
    }

    const processedConversations: string[] = [];

    for (const conversationId of conversationIds) {
      const conversation = await ctx.db.get(conversationId);
      if (!conversation) continue;

      // Verify this conversation belongs to the host (either as owner or renter)
      if (conversation.ownerId !== hostId && conversation.renterId !== hostId) {
        throw new Error(
          'Not authorized to perform this action on this conversation'
        );
      }

      switch (action) {
        case 'archive':
          await ctx.db.patch(conversationId, {
            isActive: false,
            updatedAt: Date.now(),
          });
          break;

        case 'unarchive':
          await ctx.db.patch(conversationId, {
            isActive: true,
            updatedAt: Date.now(),
          });
          break;

        case 'mark_read': {
          // Mark all unread messages as read
          const unreadMessages = await ctx.db
            .query('messages')
            .withIndex('by_unread', q =>
              q.eq('conversationId', conversationId).eq('isRead', false)
            )
            .filter(q => q.neq(q.field('senderId'), hostId))
            .collect();

          for (const message of unreadMessages) {
            await ctx.db.patch(message._id, {
              isRead: true,
              readAt: Date.now(),
            });
          }

          await ctx.db.patch(conversationId, {
            unreadCountOwner: 0,
            updatedAt: Date.now(),
          });
          break;
        }

        case 'delete': {
          // Delete all messages in the conversation
          const messages = await ctx.db
            .query('messages')
            .withIndex('by_conversation', q =>
              q.eq('conversationId', conversationId)
            )
            .collect();

          for (const message of messages) {
            await ctx.db.delete(message._id);
          }

          // Delete the conversation
          await ctx.db.delete(conversationId);
          break;
        }
      }

      processedConversations.push(conversationId);
    }

    return {
      action,
      processedCount: processedConversations.length,
      conversationIds: processedConversations,
    };
  },
});

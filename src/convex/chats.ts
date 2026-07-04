import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

export const get = query({
  args: { id: v.id('chats') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByUser = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const chatIds = memberships.map((m) => m.chatId);
    const membershipMap = new Map(memberships.map((m) => [m.chatId, m]));

    return Promise.all(
      chatIds.map(async (chatId) => {
        const chat = await ctx.db.get(chatId);
        if (!chat) return null;

        const allMembers = await ctx.db
          .query('chatMembers')
          .withIndex('by_chat', (q) => q.eq('chatId', chatId))
          .collect();

        let displayName: string | null = null;
        let displayAvatar: string | null = null;

        if (allMembers.length === 2) {
          const otherMembership = allMembers.find((m) => m.userId !== args.userId);
          if (otherMembership) {
            const otherUser = await ctx.db.get(otherMembership.userId);
            if (otherUser) {
              displayName = otherUser.name;
              displayAvatar = otherUser.avatarUrl ?? null;
            }
          }
        }

        const lastMsg = await ctx.db
          .query('messages')
          .withIndex('by_chat', (q) => q.eq('chatId', chatId))
          .order('desc')
          .first();

        const myMembership = membershipMap.get(chatId);
        let unreadCount = 0;
        if (myMembership?.lastReadAt) {
          const unreadMessages = await ctx.db
            .query('messages')
            .withIndex('by_chat_sentAt', (q) => q.eq('chatId', chatId).gt('sentAt', myMembership.lastReadAt!))
            .collect();
          unreadCount = unreadMessages.length;
        }

        let lastMessageSnippet: string | null = null;
        if (lastMsg) {
          if (lastMsg.content) {
            lastMessageSnippet = lastMsg.content;
          } else if (lastMsg.imageStorageId) {
            lastMessageSnippet = '📷 Image';
          }
        }

        return {
          ...chat,
          displayName,
          displayAvatar,
          lastMessageSnippet,
          lastMessageAt: lastMsg?.sentAt ?? null,
          lastMessageSenderId: lastMsg?.senderId ?? null,
          unreadCount,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const chatId = await ctx.db.insert('chats', { name: args.name, createdAt: now });
    await Promise.all(
      args.memberIds.map((userId) => ctx.db.insert('chatMembers', { chatId, userId, joinedAt: now, lastReadAt: now })),
    );
    return chatId;
  },
});

export const addMember = mutation({
  args: {
    chatId: v.id('chats'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('chatMembers')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('chatMembers', {
      chatId: args.chatId,
      userId: args.userId,
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    chatId: v.id('chats'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('chatMembers')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const listMembers = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('chatMembers')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .collect();
    return Promise.all(rows.map((r) => ctx.db.get(r.userId)));
  },
});

export const rename = mutation({
  args: { id: v.id('chats'), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: { id: v.id('chats') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getOrCreateDirectChat = mutation({
  args: {
    userA: v.id('users'),
    userB: v.id('users'),
  },
  handler: async (ctx, args) => {
    if (args.userA === args.userB) {
      throw new Error('Cannot start a chat with yourself.');
    }

    const membershipsA = await ctx.db
      .query('chatMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userA))
      .collect();

    const membershipsB = await ctx.db
      .query('chatMembers')
      .withIndex('by_user', (q) => q.eq('userId', args.userB))
      .collect();

    const chatIdsA = new Set(membershipsA.map((m) => m.chatId));
    let commonChatId: Id<'chats'> | null = null;

    for (const mB of membershipsB) {
      if (chatIdsA.has(mB.chatId)) {
        const members = await ctx.db
          .query('chatMembers')
          .withIndex('by_chat', (q) => q.eq('chatId', mB.chatId))
          .collect();
        if (members.length === 2) {
          commonChatId = mB.chatId;
          break;
        }
      }
    }

    if (commonChatId) {
      return commonChatId;
    }

    const userADoc = await ctx.db.get(args.userA);
    const userBDoc = await ctx.db.get(args.userB);
    const chatName = `${userADoc?.name || 'User'} & ${userBDoc?.name || 'User'}`;

    const now = Date.now();
    const chatId = await ctx.db.insert('chats', { name: chatName, createdAt: now });
    await ctx.db.insert('chatMembers', { chatId, userId: args.userA, joinedAt: now, lastReadAt: now });
    await ctx.db.insert('chatMembers', { chatId, userId: args.userB, joinedAt: now, lastReadAt: now });

    return chatId;
  },
});

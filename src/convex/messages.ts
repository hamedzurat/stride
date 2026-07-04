import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

export const listByChat = query({
  args: {
    chatId: v.id('chats'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query('messages')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .order('asc');
    return args.limit ? await q.take(args.limit) : await q.collect();
  },
});

export const listWithSender = query({
  args: {
    chatId: v.id('chats'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = ctx.db
      .query('messages')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .order('asc');
    const messages = args.limit ? await q.take(args.limit) : await q.collect();

    return Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);

        let imageUrl: string | null = null;
        if (msg.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(msg.imageStorageId);
        }

        let replyTo: { content: string; senderName: string; senderId: Id<'users'> } | null = null;
        if (msg.replyToId) {
          const repliedMsg = await ctx.db.get(msg.replyToId);
          if (repliedMsg) {
            const repliedSender = await ctx.db.get(repliedMsg.senderId);
            replyTo = {
              content: repliedMsg.content,
              senderName: repliedSender?.name ?? 'Unknown',
              senderId: repliedMsg.senderId,
            };
          }
        }

        const reactions = await ctx.db
          .query('messageReactions')
          .withIndex('by_message', (q) => q.eq('messageId', msg._id))
          .collect();

        const emojiMap = new Map<string, { count: number; userIds: Id<'users'>[] }>();
        for (const r of reactions) {
          let entry = emojiMap.get(r.emoji);
          if (!entry) {
            entry = { count: 0, userIds: [] };
            emojiMap.set(r.emoji, entry);
          }
          entry.count++;
          entry.userIds.push(r.userId);
        }
        const reactionList = Array.from(emojiMap, ([emoji, data]) => ({ emoji, ...data }));

        return {
          ...msg,
          senderName: sender?.name ?? 'Unknown',
          senderAvatar:
            sender?.avatarUrl ??
            `https://api.dicebear.com/9.x/thumbs/svg?seed=${sender?.email ?? sender?.name ?? 'unknown'}`,
          imageUrl,
          replyTo,
          reactions: reactionList,
        };
      }),
    );
  },
});

export const send = mutation({
  args: {
    chatId: v.id('chats'),
    senderId: v.id('users'),
    content: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    replyToId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args) => {
    const { imageStorageId, replyToId, ...rest } = args;
    const messageId = await ctx.db.insert('messages', {
      ...rest,
      ...(imageStorageId ? { imageStorageId } : {}),
      ...(replyToId ? { replyToId } : {}),
      sentAt: Date.now(),
    });

    await ctx.db
      .query('chatMembers')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .filter((q) => q.eq(q.field('userId'), args.senderId))
      .first()
      .then((membership) => {
        if (membership) {
          ctx.db.patch(membership._id, { lastReadAt: Date.now() });
        }
      });

    return messageId;
  },
});

export const markRead = mutation({
  args: {
    chatId: v.id('chats'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('chatMembers')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .filter((q) => q.eq(q.field('userId'), args.userId))
      .first();
    if (membership) {
      await ctx.db.patch(membership._id, { lastReadAt: Date.now() });
    }
  },
});

export const edit = mutation({
  args: { id: v.id('messages'), content: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { content: args.content });
  },
});

export const remove = mutation({
  args: { id: v.id('messages') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id('messages'),
    userId: v.id('users'),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('messageReactions')
      .withIndex('by_message_and_user', (q) => q.eq('messageId', args.messageId).eq('userId', args.userId))
      .filter((q) => q.eq(q.field('emoji'), args.emoji))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert('messageReactions', {
        messageId: args.messageId,
        userId: args.userId,
        emoji: args.emoji,
      });
    }
  },
});

export const updateTyping = mutation({
  args: {
    chatId: v.id('chats'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('typingIndicators')
      .withIndex('by_chat_and_user', (q) => q.eq('chatId', args.chatId).eq('userId', args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastTypingAt: Date.now() });
    } else {
      await ctx.db.insert('typingIndicators', {
        chatId: args.chatId,
        userId: args.userId,
        lastTypingAt: Date.now(),
      });
    }
  },
});

export const getTypingUsers = query({
  args: {
    chatId: v.id('chats'),
    currentUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threeSecondsAgo = now - 3000;
    const typingEntries = await ctx.db
      .query('typingIndicators')
      .withIndex('by_chat', (q) => q.eq('chatId', args.chatId))
      .collect();

    const recent = typingEntries.filter((t) => t.userId !== args.currentUserId && t.lastTypingAt > threeSecondsAgo);

    return Promise.all(
      recent.map(async (t) => {
        const user = await ctx.db.get(t.userId);
        return { userId: t.userId, name: user?.name ?? 'Unknown' };
      }),
    );
  },
});

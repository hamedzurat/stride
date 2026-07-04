import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';

export const heartbeat = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert('presence', {
        userId: args.userId,
        lastSeenAt: now,
      });
    }
  },
});

export const getPresence = query({
  args: {
    userIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const result: Record<string, boolean> = {};

    for (const userId of args.userIds) {
      const entry = await ctx.db
        .query('presence')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .first();
      result[userId] = entry ? entry.lastSeenAt > oneMinuteAgo : false;
    }

    return result;
  },
});

export const cleanupStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const allEntries = await ctx.db.query('presence').collect();
    const stale = allEntries.filter((e) => e.lastSeenAt < fiveMinutesAgo);
    for (const entry of stale) {
      await ctx.db.delete(entry._id);
    }
  },
});

export const cleanupStaleTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tenSecondsAgo = Date.now() - 10000;
    const allEntries = await ctx.db.query('typingIndicators').collect();
    const stale = allEntries.filter((e) => e.lastTypingAt < tenSecondsAgo);
    for (const entry of stale) {
      await ctx.db.delete(entry._id);
    }
  },
});

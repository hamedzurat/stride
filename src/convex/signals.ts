import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const send = mutation({
  args: { from: v.string(), to: v.string(), type: v.string(), data: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert('signals', args);
  },
});

export const getFor = query({
  args: { to: v.string() },
  handler: async (ctx, { to }) => {
    return ctx.db
      .query('signals')
      .withIndex('by_to', (q) => q.eq('to', to))
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id('signals') },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

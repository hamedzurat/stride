import { v } from 'convex/values';

import { query } from './_generated/server';

export const getTable = query({
  args: {
    tableName: v.union(
      v.literal('users'),
      v.literal('sections'),
      v.literal('activities'),
      v.literal('problems'),
      v.literal('posts'),
    ),
  },
  handler: async (ctx, args) => {
    const rows = (await ctx.db.query(args.tableName as any).collect()) as any[];

    if (args.tableName === 'activities') {
      return await Promise.all(
        rows.map(async (row) => {
          const section = (await ctx.db.get(row.sectionId)) as any;
          const { sectionId: _sectionId, ...rest } = row;
          return {
            ...rest,
            section: section?.name ?? 'Unknown Section',
          };
        }),
      );
    }

    if (args.tableName === 'problems') {
      return await Promise.all(
        rows.map(async (row) => {
          const user = (await ctx.db.get(row.createdBy)) as any;
          const { createdBy: _createdBy, ...rest } = row;
          return {
            ...rest,
            createdBy: user?.name ?? 'Unknown User',
          };
        }),
      );
    }

    if (args.tableName === 'posts') {
      return await Promise.all(
        rows.map(async (row) => {
          const user = (await ctx.db.get(row.authorId)) as any;
          const { authorId: _authorId, ...rest } = row;
          return {
            ...rest,
            author: user?.name ?? 'Unknown User',
          };
        }),
      );
    }

    return rows;
  },
});

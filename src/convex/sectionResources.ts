import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const list = query({
  args: { sectionId: v.id('sections') },
  handler: async (ctx, args) => {
    const resources = await ctx.db
      .query('sectionResources')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .collect();

    return await Promise.all(
      resources.map(async (resource) => {
        const uploader = await ctx.db.get(resource.uploadedBy);
        const downloadUrl = await ctx.storage.getUrl(resource.storageId);
        const metadata = await ctx.db.system.get('_storage', resource.storageId);
        return {
          ...resource,
          uploaderName: uploader?.name || 'Unknown',
          downloadUrl,
          size: metadata?.size,
          contentType: metadata?.contentType,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    sectionId: v.id('sections'),
    storageId: v.id('_storage'),
    title: v.string(),
    group: v.optional(v.string()),
    uploadedBy: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.uploadedBy);
    if (!user) {
      throw new Error('User not found.');
    }

    const isTeacher = await ctx.db
      .query('sectionTeachers')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .filter((q) => q.eq(q.field('teacherId'), args.uploadedBy))
      .first();

    const isAdmin = user.role === 'admin';

    if (!isTeacher && !isAdmin) {
      throw new Error('Only teachers and admins can upload files to this section.');
    }

    const now = Date.now();
    return await ctx.db.insert('sectionResources', {
      sectionId: args.sectionId,
      storageId: args.storageId,
      title: args.title.trim(),
      group: args.group?.trim() || undefined,
      uploadedBy: args.uploadedBy,
      createdAt: now,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id('sectionResources'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const resource = await ctx.db.get(args.id);
    if (!resource) {
      throw new Error('Resource not found.');
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const isTeacher = await ctx.db
      .query('sectionTeachers')
      .withIndex('by_section', (q) => q.eq('sectionId', resource.sectionId))
      .filter((q) => q.eq(q.field('teacherId'), args.userId))
      .first();

    const isAdmin = user.role === 'admin';

    if (!isTeacher && !isAdmin) {
      throw new Error('Only teachers and admins can delete files from this section.');
    }

    try {
      await ctx.storage.delete(resource.storageId);
    } catch (e) {
      console.error('Failed to delete file from Convex storage:', e);
    }

    await ctx.db.delete(args.id);
  },
});

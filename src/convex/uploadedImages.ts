import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, type MutationCtx } from './_generated/server';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getImageUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const registerUploadedImage = mutation({
  args: {
    storageId: v.id('_storage'),
    authorId: v.id('users'),
    isAvatar: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert('uploadedImages', {
      storageId: args.storageId,
      authorId: args.authorId,
      isAvatar: args.isAvatar,
      createdAt: now,
    });
  },
});

export const deleteUploadedImages = mutation({
  args: {
    storageIds: v.array(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    for (const storageId of args.storageIds) {
      const img = await ctx.db
        .query('uploadedImages')
        .withIndex('by_storage', (q) => q.eq('storageId', storageId))
        .first();
      if (
        img &&
        !img.postId &&
        !img.commentId &&
        !img.aboutUserId &&
        !img.sectionId &&
        !img.problemId &&
        !img.isAvatar
      ) {
        try {
          await ctx.storage.delete(storageId);
        } catch (e) {
          console.error('Failed to delete image from storage on cancel:', e);
        }
        await ctx.db.delete(img._id);
      }
    }
  },
});

export const cleanupOldPendingImages = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Clean up images that are older than 24 hours and still in "pending" status (no postId, no commentId, no aboutUserId, no sectionId, no problemId, and no isAvatar)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const allPending = await ctx.db.query('uploadedImages').collect();
    const oldPending = allPending.filter(
      (img) =>
        !img.postId &&
        !img.commentId &&
        !img.aboutUserId &&
        !img.sectionId &&
        !img.problemId &&
        !img.isAvatar &&
        img.createdAt < twentyFourHoursAgo,
    );

    console.log(`[CRON] Found ${oldPending.length} old pending images to clean up.`);

    for (const img of oldPending) {
      try {
        await ctx.storage.delete(img.storageId);
        console.log(`[CRON] Deleted storage file ${img.storageId}`);
      } catch (e) {
        console.error(`[CRON] Failed to delete storage file ${img.storageId}:`, e);
      }
      await ctx.db.delete(img._id);
    }
  },
});

// --- Helper Functions for Rich Text Editor Image Tracking ---

export async function associateImagesForUserProfile(ctx: MutationCtx, userId: Id<'users'>, aboutMd: string) {
  const pending = await ctx.db
    .query('uploadedImages')
    .withIndex('by_author', (q) => q.eq('authorId', userId))
    .collect();

  // Find images that are not associated with any post or comment or other user
  const pendingUnused = pending.filter((img) => !img.postId && !img.commentId && !img.aboutUserId);

  for (const img of pendingUnused) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      aboutMd.includes(img.storageId) ||
      (imageUrl !== null && aboutMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && aboutMd.includes(pathSegment));

    if (isUsedInBody) {
      await ctx.db.patch(img._id, { aboutUserId: userId });
    }
  }

  // Find images currently associated with this user's profile
  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_aboutUserId', (q) => q.eq('aboutUserId', userId))
    .collect();

  for (const img of associated) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      aboutMd.includes(img.storageId) ||
      (imageUrl !== null && aboutMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && aboutMd.includes(pathSegment));

    if (!isUsedInBody) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete unused user profile image from storage:', e);
      }
      await ctx.db.delete(img._id);
    }
  }
}

export const deletePreviousAvatars = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query('uploadedImages')
      .withIndex('by_author', (q) => q.eq('authorId', args.userId))
      .collect();

    const avatarImages = images.filter((img) => img.isAvatar === true);

    for (const img of avatarImages) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete previous avatar from storage:', e);
      }
      await ctx.db.delete(img._id);
    }
  },
});

export async function associateImagesForSection(ctx: MutationCtx, sectionId: Id<'sections'>, aboutMd: string) {
  const pending = await ctx.db.query('uploadedImages').collect();
  const pendingUnused = pending.filter(
    (img) => !img.postId && !img.commentId && !img.aboutUserId && !img.sectionId && !img.problemId,
  );

  for (const img of pendingUnused) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      aboutMd.includes(img.storageId) ||
      (imageUrl !== null && aboutMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && aboutMd.includes(pathSegment));

    if (isUsedInBody) {
      await ctx.db.patch(img._id, { sectionId });
    }
  }

  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_section', (q) => q.eq('sectionId', sectionId))
    .collect();

  for (const img of associated) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      aboutMd.includes(img.storageId) ||
      (imageUrl !== null && aboutMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && aboutMd.includes(pathSegment));

    if (!isUsedInBody) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete unused section image from storage:', e);
      }
      await ctx.db.delete(img._id);
    }
  }
}

export async function associateImagesForProblem(ctx: MutationCtx, problemId: Id<'problems'>, contentMd: string) {
  const pending = await ctx.db.query('uploadedImages').collect();
  const pendingUnused = pending.filter(
    (img) => !img.postId && !img.commentId && !img.aboutUserId && !img.sectionId && !img.problemId,
  );

  for (const img of pendingUnused) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      contentMd.includes(img.storageId) ||
      (imageUrl !== null && contentMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && contentMd.includes(pathSegment));

    if (isUsedInBody) {
      await ctx.db.patch(img._id, { problemId });
    }
  }

  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_problem', (q) => q.eq('problemId', problemId))
    .collect();

  for (const img of associated) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      contentMd.includes(img.storageId) ||
      (imageUrl !== null && contentMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && contentMd.includes(pathSegment));

    if (!isUsedInBody) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete unused problem image from storage:', e);
      }
      await ctx.db.delete(img._id);
    }
  }
}

import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';

export const get = query({
  args: { id: v.id('comments') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all comments on a post in one query (helps assemble trees on the client)
export const listAllByPost = query({
  args: {
    postId: v.id('posts'),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();

    return Promise.all(
      comments.map(async (c) => {
        const author = await ctx.db.get(c.authorId);

        let userVote = 0;
        if (args.userId) {
          const voteRecord = await ctx.db
            .query('commentVotes')
            .withIndex('by_comment_and_user', (q) => q.eq('commentId', c._id).eq('userId', args.userId!))
            .first();
          userVote = voteRecord ? voteRecord.value : 0;
        }

        return {
          ...c,
          authorName: author?.name ?? 'Anonymous',
          authorAvatar: author?.avatarUrl ?? null,
          authorRole: author?.role ?? 'student',
          userVote,
          score: c.score ?? 0,
        };
      }),
    );
  },
});

// Top-level comments on a post (no parent)
export const listByPost = query({
  args: { postId: v.id('posts') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .filter((q) => q.eq(q.field('parentCommentId'), undefined))
      .collect();
  },
});

// Replies to a comment
export const listReplies = query({
  args: { parentCommentId: v.id('comments') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('comments')
      .withIndex('by_parent', (q) => q.eq('parentCommentId', args.parentCommentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    authorId: v.id('users'),
    postId: v.id('posts'),
    content: v.string(),
    parentCommentId: v.optional(v.id('comments')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const commentId = await ctx.db.insert('comments', {
      ...args,
      score: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Auto upvote by creator
    await ctx.db.insert('commentVotes', {
      commentId,
      userId: args.authorId,
      value: 1,
    });

    // Associate uploaded images
    await associateImagesForComment(ctx, args.authorId, commentId, args.postId, args.content);

    return commentId;
  },
});

export const vote = mutation({
  args: {
    commentId: v.id('comments'),
    userId: v.id('users'),
    value: v.union(v.literal(1), v.literal(-1), v.literal(0)),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error('Comment not found');

    const existingVote = await ctx.db
      .query('commentVotes')
      .withIndex('by_comment_and_user', (q) => q.eq('commentId', args.commentId).eq('userId', args.userId))
      .first();

    let scoreDiff = 0;

    if (existingVote) {
      if (args.value === 0) {
        scoreDiff = -existingVote.value;
        await ctx.db.delete(existingVote._id);
      } else if (existingVote.value !== args.value) {
        scoreDiff = args.value - existingVote.value;
        await ctx.db.patch(existingVote._id, { value: args.value });
      }
    } else {
      if (args.value !== 0) {
        scoreDiff = args.value;
        await ctx.db.insert('commentVotes', {
          commentId: args.commentId,
          userId: args.userId,
          value: args.value,
        });
      }
    }

    if (scoreDiff !== 0) {
      const currentScore = comment.score ?? 0;
      await ctx.db.patch(args.commentId, { score: currentScore + scoreDiff });
    }
  },
});

export const update = mutation({
  args: {
    id: v.id('comments'),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error('Comment not found');

    await ctx.db.patch(args.id, { content: args.content, updatedAt: Date.now() });

    await associateImagesForComment(ctx, comment.authorId, args.id, comment.postId, args.content);
  },
});

export const remove = mutation({
  args: {
    id: v.id('comments'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.id);
    if (!comment) throw new Error('Comment not found');

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error('User not found');

    let deletedBy: 'user' | 'moderator';
    if (comment.authorId === args.userId) {
      deletedBy = 'user';
    } else if (user.role === 'admin' || user.role === 'teacher') {
      deletedBy = 'moderator';
    } else {
      throw new Error('Unauthorized to delete this comment');
    }

    const deletedMessage = deletedBy === 'moderator' ? 'moderator' : 'user';

    // Delete associated images from storage & uploadedImages table
    await deleteImagesForComment(ctx, args.id);

    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedBy,
      content: `<p><em>[This comment has been deleted by ${deletedMessage}]</em></p>`,
      updatedAt: Date.now(),
    });
  },
});

// --- Helper Functions for Rich Text Editor Image Tracking ---

async function associateImagesForComment(
  ctx: MutationCtx,
  authorId: Id<'users'>,
  commentId: Id<'comments'>,
  postId: Id<'posts'>,
  content: string,
) {
  const pending = await ctx.db
    .query('uploadedImages')
    .withIndex('by_author', (q) => q.eq('authorId', authorId))
    .collect();

  const pendingUnused = pending.filter((img) => !img.postId && !img.commentId);

  for (const img of pendingUnused) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsed =
      content.includes(img.storageId) ||
      (imageUrl !== null && content.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && content.includes(pathSegment));

    if (isUsed) {
      await ctx.db.patch(img._id, { postId, commentId });
    }
  }

  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_comment', (q) => q.eq('commentId', commentId))
    .collect();

  for (const img of associated) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsed =
      content.includes(img.storageId) ||
      (imageUrl !== null && content.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && content.includes(pathSegment));

    if (!isUsed) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete unused comment image from storage:', e);
      }
      await ctx.db.delete(img._id);
    }
  }
}

async function deleteImagesForComment(ctx: MutationCtx, commentId: Id<'comments'>) {
  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_comment', (q) => q.eq('commentId', commentId))
    .collect();
  for (const img of associated) {
    try {
      await ctx.storage.delete(img.storageId);
    } catch (e) {
      console.error('Failed to delete comment image on deletion:', e);
    }
    await ctx.db.delete(img._id);
  }
}

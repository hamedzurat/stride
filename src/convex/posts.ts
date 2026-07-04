import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx } from './_generated/server';

export const get = query({
  args: {
    id: v.id('posts'),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.id);
    if (!post) return null;

    const author = (await ctx.db.get(post.authorId)) as Doc<'users'> | null;
    const imageUrl = post.storageId ? await ctx.storage.getUrl(post.storageId) : null;

    const postTags = await ctx.db
      .query('postTags')
      .withIndex('by_post', (q) => q.eq('postId', args.id))
      .collect();
    const tags = (await Promise.all(postTags.map((pt) => ctx.db.get(pt.tagId)))).filter(Boolean);

    const commentDocs = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', args.id))
      .collect();
    const commentCount = commentDocs.length;

    let userVote = 0;
    if (args.userId) {
      const voteRecord = await ctx.db
        .query('postVotes')
        .withIndex('by_post_and_user', (q) => q.eq('postId', args.id).eq('userId', args.userId!))
        .first();
      userVote = voteRecord ? voteRecord.value : 0;
    }

    return {
      ...post,
      authorName: author?.name ?? 'Anonymous',
      authorAvatar: author?.avatarUrl ?? null,
      authorRole: author?.role ?? 'student',
      imageUrl,
      tags,
      commentCount,
      userVote,
      score: post.score ?? 0,
    };
  },
});

export const list = query({
  args: {
    userId: v.optional(v.id('users')),
    tagIds: v.optional(v.array(v.id('tags'))),
    sortBy: v.optional(v.union(v.literal('new'), v.literal('top'), v.literal('hot'))),
    onlyMyPosts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let posts;
    if (args.tagIds && args.tagIds.length > 0) {
      const allPostIds = new Set<string>();
      for (const tId of args.tagIds) {
        const mappings = await ctx.db
          .query('postTags')
          .withIndex('by_tag', (q) => q.eq('tagId', tId))
          .collect();
        for (const m of mappings) {
          allPostIds.add(m.postId);
        }
      }
      posts = (await Promise.all(Array.from(allPostIds).map((id) => ctx.db.get(id as Id<'posts'>)))).filter(
        (p): p is Doc<'posts'> => p !== null,
      );
    } else {
      posts = await ctx.db.query('posts').collect();
    }

    if (args.onlyMyPosts && args.userId) {
      posts = posts.filter((p) => p.authorId === args.userId);
    }

    const enriched = await Promise.all(
      posts.map(async (p) => {
        const author = (await ctx.db.get(p.authorId)) as Doc<'users'> | null;
        const imageUrl = p.storageId ? await ctx.storage.getUrl(p.storageId) : null;
        const postTags = await ctx.db
          .query('postTags')
          .withIndex('by_post', (q) => q.eq('postId', p._id))
          .collect();
        const tags = (await Promise.all(postTags.map((pt) => ctx.db.get(pt.tagId)))).filter(Boolean);

        const commentDocs = await ctx.db
          .query('comments')
          .withIndex('by_post', (q) => q.eq('postId', p._id))
          .collect();
        const commentCount = commentDocs.length;

        let userVote = 0;
        if (args.userId) {
          const voteRecord = await ctx.db
            .query('postVotes')
            .withIndex('by_post_and_user', (q) => q.eq('postId', p._id).eq('userId', args.userId!))
            .first();
          userVote = voteRecord ? voteRecord.value : 0;
        }

        return {
          ...p,
          authorName: author?.name ?? 'Anonymous',
          authorAvatar: author?.avatarUrl ?? null,
          authorRole: author?.role ?? 'student',
          imageUrl,
          tags,
          commentCount,
          userVote,
          score: p.score ?? 0,
        };
      }),
    );

    if (args.sortBy === 'top') {
      enriched.sort((a, b) => b.score - a.score);
    } else if (args.sortBy === 'hot') {
      const now = Date.now();
      const getHotScore = (item: (typeof enriched)[number]) => {
        const creationTime = item._creationTime ?? now;
        const hoursAge = (now - creationTime) / (3600 * 1000);
        const engagementScore = (item.score ?? 0) + (item.commentCount ?? 0);
        return engagementScore / Math.pow(hoursAge + 2, 1.5);
      };
      enriched.sort((a, b) => getHotScore(b) - getHotScore(a));
    } else {
      enriched.sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0));
    }

    return enriched;
  },
});

export const listByAuthor = query({
  args: {
    authorId: v.id('users'),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', (q) => q.eq('authorId', args.authorId))
      .order('desc')
      .collect();

    return Promise.all(
      posts.map(async (p) => {
        const author = (await ctx.db.get(p.authorId)) as Doc<'users'> | null;
        const imageUrl = p.storageId ? await ctx.storage.getUrl(p.storageId) : null;
        const postTags = await ctx.db
          .query('postTags')
          .withIndex('by_post', (q) => q.eq('postId', p._id))
          .collect();
        const tags = (await Promise.all(postTags.map((pt) => ctx.db.get(pt.tagId)))).filter(Boolean);

        const commentDocs = await ctx.db
          .query('comments')
          .withIndex('by_post', (q) => q.eq('postId', p._id))
          .collect();
        const commentCount = commentDocs.length;

        let userVote = 0;
        if (args.userId) {
          const voteRecord = await ctx.db
            .query('postVotes')
            .withIndex('by_post_and_user', (q) => q.eq('postId', p._id).eq('userId', args.userId!))
            .first();
          userVote = voteRecord ? voteRecord.value : 0;
        }

        return {
          ...p,
          authorName: author?.name ?? 'Anonymous',
          authorAvatar: author?.avatarUrl ?? null,
          authorRole: author?.role ?? 'student',
          imageUrl,
          tags,
          commentCount,
          userVote,
          score: p.score ?? 0,
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    authorId: v.id('users'),
    title: v.string(),
    contentMd: v.string(),
    storageId: v.optional(v.id('_storage')),
    tagIds: v.optional(v.array(v.id('tags'))),
  },
  handler: async (ctx, { tagIds, ...args }) => {
    const now = Date.now();
    const postId = await ctx.db.insert('posts', {
      ...args,
      score: 1,
      createdAt: now,
      updatedAt: now,
    });
    if (tagIds?.length) {
      await Promise.all(tagIds.map((tagId) => ctx.db.insert('postTags', { postId, tagId })));
    }

    // Auto upvote the post by the author
    await ctx.db.insert('postVotes', {
      postId,
      userId: args.authorId,
      value: 1,
    });

    // Associate uploaded images
    await associateImagesForPost(ctx, args.authorId, postId, args.contentMd, args.storageId);

    return postId;
  },
});

export const vote = mutation({
  args: {
    postId: v.id('posts'),
    userId: v.id('users'),
    value: v.union(v.literal(1), v.literal(-1), v.literal(0)),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error('Post not found');

    const existingVote = await ctx.db
      .query('postVotes')
      .withIndex('by_post_and_user', (q) => q.eq('postId', args.postId).eq('userId', args.userId))
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
        await ctx.db.insert('postVotes', {
          postId: args.postId,
          userId: args.userId,
          value: args.value,
        });
      }
    }

    if (scoreDiff !== 0) {
      const currentScore = post.score ?? 0;
      await ctx.db.patch(args.postId, { score: currentScore + scoreDiff });
    }
  },
});

export const update = mutation({
  args: {
    id: v.id('posts'),
    title: v.optional(v.string()),
    contentMd: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const post = await ctx.db.get(id);
    if (!post) throw new Error('Post not found');

    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });

    if (fields.contentMd !== undefined) {
      await associateImagesForPost(ctx, post.authorId, id, fields.contentMd, post.storageId);
    }
  },
});

export const remove = mutation({
  args: { id: v.id('posts') },
  handler: async (ctx, args) => {
    // Delete associated votes
    const votes = await ctx.db
      .query('postVotes')
      .withIndex('by_post', (q) => q.eq('postId', args.id))
      .collect();
    await Promise.all(votes.map((v) => ctx.db.delete(v._id)));

    // Delete associated postTags
    const postTags = await ctx.db
      .query('postTags')
      .withIndex('by_post', (q) => q.eq('postId', args.id))
      .collect();
    await Promise.all(postTags.map((pt) => ctx.db.delete(pt._id)));

    // Delete comments & associated comment votes
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_post', (q) => q.eq('postId', args.id))
      .collect();

    await Promise.all(
      comments.map(async (c) => {
        const votes = await ctx.db
          .query('commentVotes')
          .withIndex('by_comment', (q) => q.eq('commentId', c._id))
          .collect();
        await Promise.all(votes.map((v) => ctx.db.delete(v._id)));
        await deleteImagesForComment(ctx, c._id);
        await ctx.db.delete(c._id);
      }),
    );

    // Delete associated images from storage & uploadedImages table
    await deleteImagesForPost(ctx, args.id);

    await ctx.db.delete(args.id);
  },
});

// --- Tags ---

export const createTag = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('tags')
      .withIndex('by_name', (q) => q.eq('name', args.name))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('tags', { name: args.name });
  },
});

export const updateTag = mutation({
  args: { id: v.id('tags'), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error('Tag not found');
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const deleteTag = mutation({
  args: { id: v.id('tags') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    const postTags = await ctx.db
      .query('postTags')
      .withIndex('by_tag', (q) => q.eq('tagId', args.id))
      .collect();
    await Promise.all(postTags.map((pt) => ctx.db.delete(pt._id)));
  },
});

export const listTags = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('tags').collect();
  },
});

export const addTag = mutation({
  args: {
    postId: v.id('posts'),
    tagId: v.id('tags'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('postTags')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .filter((q) => q.eq(q.field('tagId'), args.tagId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('postTags', args);
  },
});

export const removeTag = mutation({
  args: {
    postId: v.id('posts'),
    tagId: v.id('tags'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('postTags')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .filter((q) => q.eq(q.field('tagId'), args.tagId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

// --- Helper Functions for Rich Text Editor Image Tracking ---

async function associateImagesForPost(
  ctx: MutationCtx,
  authorId: Id<'users'>,
  postId: Id<'posts'>,
  contentMd: string,
  coverStorageId?: Id<'_storage'>,
) {
  const pending = await ctx.db
    .query('uploadedImages')
    .withIndex('by_author', (q) => q.eq('authorId', authorId))
    .collect();

  const pendingUnused = pending.filter((img) => !img.postId && !img.commentId);

  for (const img of pendingUnused) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      contentMd.includes(img.storageId) ||
      (imageUrl !== null && contentMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && contentMd.includes(pathSegment));
    const isCover = coverStorageId && img.storageId === coverStorageId;

    if (isUsedInBody || isCover) {
      await ctx.db.patch(img._id, { postId });
    }
  }

  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();

  for (const img of associated) {
    const imageUrl = await ctx.storage.getUrl(img.storageId);
    const pathSegment = imageUrl ? imageUrl.split('/').pop()?.split('?')[0] : null;
    const isUsedInBody =
      contentMd.includes(img.storageId) ||
      (imageUrl !== null && contentMd.includes(imageUrl)) ||
      (pathSegment !== null && pathSegment !== undefined && pathSegment !== '' && contentMd.includes(pathSegment));
    const isCover = coverStorageId && img.storageId === coverStorageId;

    if (!isUsedInBody && !isCover) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete unused post image from storage:', e);
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

async function deleteImagesForPost(ctx: MutationCtx, postId: Id<'posts'>) {
  const post = (await ctx.db.get(postId)) as Doc<'posts'> | null;
  if (post && post.storageId) {
    try {
      await ctx.storage.delete(post.storageId);
    } catch (e) {
      console.error('Failed to delete post cover image:', e);
    }
  }

  const associated = await ctx.db
    .query('uploadedImages')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect();
  for (const img of associated) {
    try {
      await ctx.storage.delete(img.storageId);
    } catch (e) {
      console.error('Failed to delete post image on deletion:', e);
    }
    await ctx.db.delete(img._id);
  }
}

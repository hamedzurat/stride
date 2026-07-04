import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { associateImagesForUserProfile } from './uploadedImages';

export const get = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const login = mutation({
  args: { email: v.string(), passwordHash: v.string() },
  handler: async (ctx, { email, passwordHash }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (!user) return null;
    if (user.passwordHash !== passwordHash) return null;

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('users').collect();
  },
});

export const listByRole = query({
  args: {
    role: v.union(v.literal('admin'), v.literal('teacher'), v.literal('student')),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('role'), args.role))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal('admin'), v.literal('teacher'), v.literal('student')),
    aboutMd: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('users', { ...args, createdAt: now, updatedAt: now });
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id('users'),
    name: v.optional(v.string()),
    aboutMd: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });

    if (fields.aboutMd !== undefined) {
      await associateImagesForUserProfile(ctx, id, fields.aboutMd);
    }
  },
});

export const getProfileData = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Fetch enrolled or taught sections based on role
    let sections: Doc<'sections'>[] = [];
    if (user.role === 'student') {
      const sectionStudents = await ctx.db
        .query('sectionStudents')
        .withIndex('by_student', (q) => q.eq('studentId', args.userId))
        .collect();
      const sectionIds = sectionStudents.map((ss) => ss.sectionId);
      sections = (await Promise.all(sectionIds.map((id) => ctx.db.get(id)))).filter(
        (s): s is Doc<'sections'> => s !== null,
      );
    } else if (user.role === 'teacher') {
      const sectionTeachers = await ctx.db
        .query('sectionTeachers')
        .withIndex('by_teacher', (q) => q.eq('teacherId', args.userId))
        .collect();
      const sectionIds = sectionTeachers.map((st) => st.sectionId);
      sections = (await Promise.all(sectionIds.map((id) => ctx.db.get(id)))).filter(
        (s): s is Doc<'sections'> => s !== null,
      );
    } else if (user.role === 'admin') {
      const sectionTeachers = await ctx.db
        .query('sectionTeachers')
        .withIndex('by_teacher', (q) => q.eq('teacherId', args.userId))
        .collect();
      const sectionIds = sectionTeachers.map((st) => st.sectionId);
      sections = (await Promise.all(sectionIds.map((id) => ctx.db.get(id)))).filter(
        (s): s is Doc<'sections'> => s !== null,
      );
    }

    // Fetch user's forum posts (latest 10)
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_author', (q) => q.eq('authorId', args.userId))
      .order('desc')
      .take(10);

    const enrichedPosts = await Promise.all(
      posts.map(async (p) => {
        const commentDocs = await ctx.db
          .query('comments')
          .withIndex('by_post', (q) => q.eq('postId', p._id))
          .collect();
        const postTags = await ctx.db
          .query('postTags')
          .withIndex('by_post', (q) => q.eq('postId', p._id))
          .collect();
        const tags = (await Promise.all(postTags.map((pt) => ctx.db.get(pt.tagId)))).filter(
          (t): t is Doc<'tags'> => t !== null,
        );
        const imageUrl = p.storageId ? await ctx.storage.getUrl(p.storageId) : null;

        return {
          ...p,
          commentCount: commentDocs.length,
          tags,
          imageUrl,
        };
      }),
    );

    // Fetch user's comments (latest 10)
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_author', (q) => q.eq('authorId', args.userId))
      .order('desc')
      .take(10);

    const enrichedComments = await Promise.all(
      comments.map(async (c) => {
        const post = await ctx.db.get(c.postId);
        return {
          ...c,
          postTitle: post?.title ?? 'Untitled Post',
        };
      }),
    );

    // Fetch total code submissions (for students)
    const submissions = await ctx.db
      .query('submissions')
      .withIndex('by_author', (q) => q.eq('authorId', args.userId))
      .collect();

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
        aboutMd: user.aboutMd ?? '',
        _creationTime: user._creationTime,
      },
      submissionsCount: submissions.length,
      acceptedCount: submissions.filter((s) => s.judgeVerdict === 'Accepted').length,
      sections: await Promise.all(
        sections.map(async (s) => {
          const st = await ctx.db
            .query('sectionTeachers')
            .withIndex('by_section', (q) => q.eq('sectionId', s._id))
            .first();
          let teacherName = 'No Teacher Assigned';
          if (st) {
            const tDoc = await ctx.db.get(st.teacherId);
            if (tDoc) {
              teacherName = tDoc.name;
            }
          }
          return {
            _id: s._id,
            name: s.name,
            aboutMd: s.aboutMd ?? '',
            teacherName,
          };
        }),
      ),
      posts: enrichedPosts,
      comments: enrichedComments,
    };
  },
});

export const updatePassword = mutation({
  args: {
    id: v.id('users'),
    passwordHash: v.string(),
  },
  handler: async (ctx, { id, passwordHash }) => {
    await ctx.db.patch(id, { passwordHash, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    id: v.id('users'),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.union(v.literal('admin'), v.literal('teacher'), v.literal('student'))),
    aboutMd: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

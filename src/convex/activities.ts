import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

export const get = query({
  args: { id: v.id('activities') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listBySection = query({
  args: { sectionId: v.id('sections') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activities')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .collect();
  },
});

export const create = mutation({
  args: {
    sectionId: v.id('sections'),
    title: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    type: v.union(v.literal('exam'), v.literal('class')),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert('activities', { ...args, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: {
    id: v.id('activities'),
    title: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    type: v.optional(v.union(v.literal('exam'), v.literal('class'))),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id('activities') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// --- Activity Problems ---

export const addProblem = mutation({
  args: {
    activityId: v.id('activities'),
    problemId: v.id('problems'),
    problemOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('activityProblems')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .filter((q) => q.eq(q.field('problemId'), args.problemId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('activityProblems', { ...args, createdAt: Date.now() });
  },
});

export const removeProblem = mutation({
  args: {
    activityId: v.id('activities'),
    problemId: v.id('problems'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('activityProblems')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .filter((q) => q.eq(q.field('problemId'), args.problemId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const reorderProblem = mutation({
  args: {
    activityId: v.id('activities'),
    problemId: v.id('problems'),
    problemOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('activityProblems')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .filter((q) => q.eq(q.field('problemId'), args.problemId))
      .first();
    if (!row) throw new Error('Activity problem not found');
    await ctx.db.patch(row._id, { problemOrder: args.problemOrder });
  },
});

export const listProblems = query({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('activityProblems')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .collect();
    const sorted = rows.sort((a, b) => a.problemOrder - b.problemOrder);
    return Promise.all(
      sorted.map(async (r) => ({
        ...r,
        problem: await ctx.db.get(r.problemId),
      })),
    );
  },
});

export const listAllByUser = query({
  args: { userId: v.id('users'), role: v.string() },
  handler: async (ctx, args) => {
    if (args.role === 'admin') {
      const activities = await ctx.db.query('activities').collect();
      return Promise.all(
        activities.map(async (a) => {
          const section = await ctx.db.get(a.sectionId);
          return {
            ...a,
            sectionName: section?.name ?? 'Unknown Section',
          };
        }),
      );
    } else if (args.role === 'teacher') {
      const rows = await ctx.db
        .query('sectionTeachers')
        .withIndex('by_teacher', (q) => q.eq('teacherId', args.userId))
        .collect();
      const sectionIds = rows.map((r) => r.sectionId);
      const allActivities = [];
      for (const sectionId of sectionIds) {
        const section = await ctx.db.get(sectionId);
        const acts = await ctx.db
          .query('activities')
          .withIndex('by_section', (q) => q.eq('sectionId', sectionId))
          .collect();
        for (const act of acts) {
          allActivities.push({
            ...act,
            sectionName: section?.name ?? 'Unknown Section',
          });
        }
      }
      return allActivities;
    } else {
      const rows = await ctx.db
        .query('sectionStudents')
        .withIndex('by_student', (q) => q.eq('studentId', args.userId))
        .collect();
      const sectionIds = rows.map((r) => r.sectionId);
      const allActivities = [];
      for (const sectionId of sectionIds) {
        const section = await ctx.db.get(sectionId);
        const acts = await ctx.db
          .query('activities')
          .withIndex('by_section', (q) => q.eq('sectionId', sectionId))
          .collect();
        for (const act of acts) {
          allActivities.push({
            ...act,
            sectionName: section?.name ?? 'Unknown Section',
          });
        }
      }
      return allActivities;
    }
  },
});

export const getLiveTelemetry = query({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    const activity = await ctx.db.get(args.activityId);
    if (!activity) return null;

    // 1. Get problems of the activity
    const activityProblems = await ctx.db
      .query('activityProblems')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .collect();
    const sortedProblems = activityProblems.sort((a, b) => a.problemOrder - b.problemOrder);
    const problems = await Promise.all(
      sortedProblems.map(async (ap) => {
        const problem = await ctx.db.get(ap.problemId);
        return {
          _id: ap.problemId,
          title: problem?.title ?? 'Unknown Problem',
        };
      }),
    );

    // 2. Get students of the section
    const studentsRows = await ctx.db
      .query('sectionStudents')
      .withIndex('by_section', (q) => q.eq('sectionId', activity.sectionId))
      .collect();
    const students = await Promise.all(
      studentsRows.map(async (s) => {
        const user = await ctx.db.get(s.studentId);
        return {
          _id: s.studentId,
          name: user?.name ?? 'Unknown Student',
          email: user?.email ?? '',
        };
      }),
    );

    // 3. Get all submissions for the activity
    const submissions = await ctx.db
      .query('submissions')
      .withIndex('by_activity_problem', (q) => q.eq('activityId', args.activityId))
      .collect();

    // 4. Get all snapshots for the activity to track last active times
    const snapshotsList = [];
    for (const p of problems) {
      const snaps = await ctx.db
        .query('snapshots')
        .withIndex('by_activity_problem', (q) => q.eq('activityId', args.activityId).eq('problemId', p._id))
        .collect();
      snapshotsList.push(...snaps);
    }

    return {
      activity,
      problems,
      students,
      submissions,
      snapshots: snapshotsList.map((s) => ({
        authorId: s.authorId,
        problemId: s.problemId,
        timestamp: s.timestamp,
      })),
    };
  },
});

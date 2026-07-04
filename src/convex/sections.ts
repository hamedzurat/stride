import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { associateImagesForSection } from './uploadedImages';

export const get = query({
  args: { id: v.id('sections') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('sections').collect();
  },
});

export const listWithMembers = query({
  args: {},
  handler: async (ctx) => {
    const sections = await ctx.db.query('sections').collect();
    return Promise.all(
      sections.map(async (section) => {
        const teachersRows = await ctx.db
          .query('sectionTeachers')
          .withIndex('by_section', (q) => q.eq('sectionId', section._id))
          .collect();
        const teachers = await Promise.all(teachersRows.map((r) => ctx.db.get(r.teacherId)));

        const studentsRows = await ctx.db
          .query('sectionStudents')
          .withIndex('by_section', (q) => q.eq('sectionId', section._id))
          .collect();
        const students = await Promise.all(studentsRows.map((r) => ctx.db.get(r.studentId)));

        return {
          ...section,
          teachers: teachers.filter(Boolean),
          students: students.filter(Boolean),
        };
      }),
    );
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    aboutMd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sectionId = await ctx.db.insert('sections', { ...args, createdAt: now, updatedAt: now });
    if (args.aboutMd) {
      await associateImagesForSection(ctx, sectionId, args.aboutMd);
    }
    return sectionId;
  },
});

export const update = mutation({
  args: {
    id: v.id('sections'),
    name: v.optional(v.string()),
    aboutMd: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
    if (fields.aboutMd !== undefined) {
      await associateImagesForSection(ctx, id, fields.aboutMd);
    }
  },
});

export const remove = mutation({
  args: { id: v.id('sections') },
  handler: async (ctx, args) => {
    const associated = await ctx.db
      .query('uploadedImages')
      .withIndex('by_section', (q) => q.eq('sectionId', args.id))
      .collect();
    for (const img of associated) {
      try {
        await ctx.storage.delete(img.storageId);
      } catch (e) {
        console.error('Failed to delete section image from storage on delete:', e);
      }
      await ctx.db.delete(img._id);
    }

    // Clean up any uploaded section files/resources
    const resources = await ctx.db
      .query('sectionResources')
      .withIndex('by_section', (q) => q.eq('sectionId', args.id))
      .collect();
    for (const res of resources) {
      try {
        await ctx.storage.delete(res.storageId);
      } catch (e) {
        console.error('Failed to delete section resource from storage on delete:', e);
      }
      await ctx.db.delete(res._id);
    }

    await ctx.db.delete(args.id);
  },
});

// --- Teachers ---

export const addTeacher = mutation({
  args: {
    sectionId: v.id('sections'),
    teacherId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('sectionTeachers')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .filter((q) => q.eq(q.field('teacherId'), args.teacherId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('sectionTeachers', {
      sectionId: args.sectionId,
      teacherId: args.teacherId,
      createdAt: Date.now(),
    });
  },
});

export const removeTeacher = mutation({
  args: {
    sectionId: v.id('sections'),
    teacherId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('sectionTeachers')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .filter((q) => q.eq(q.field('teacherId'), args.teacherId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const listTeachers = query({
  args: { sectionId: v.id('sections') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('sectionTeachers')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .collect();
    return Promise.all(rows.map((r) => ctx.db.get(r.teacherId)));
  },
});

export const listSectionsByTeacher = query({
  args: { teacherId: v.id('users') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('sectionTeachers')
      .withIndex('by_teacher', (q) => q.eq('teacherId', args.teacherId))
      .collect();
    return Promise.all(rows.map((r) => ctx.db.get(r.sectionId)));
  },
});

// --- Students ---

export const addStudent = mutation({
  args: {
    sectionId: v.id('sections'),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('sectionStudents')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .filter((q) => q.eq(q.field('studentId'), args.studentId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert('sectionStudents', {
      sectionId: args.sectionId,
      studentId: args.studentId,
      createdAt: Date.now(),
    });
  },
});

export const removeStudent = mutation({
  args: {
    sectionId: v.id('sections'),
    studentId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('sectionStudents')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .filter((q) => q.eq(q.field('studentId'), args.studentId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const listStudents = query({
  args: { sectionId: v.id('sections') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('sectionStudents')
      .withIndex('by_section', (q) => q.eq('sectionId', args.sectionId))
      .collect();
    return Promise.all(rows.map((r) => ctx.db.get(r.studentId)));
  },
});

export const listSectionsByStudent = query({
  args: { studentId: v.id('users') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('sectionStudents')
      .withIndex('by_student', (q) => q.eq('studentId', args.studentId))
      .collect();
    return Promise.all(rows.map((r) => ctx.db.get(r.sectionId)));
  },
});

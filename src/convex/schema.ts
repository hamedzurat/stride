import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.union(v.literal('admin'), v.literal('teacher'), v.literal('student')),
    aboutMd: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_name', ['name'])
    .index('by_email', ['email']),

  sections: defineTable({
    name: v.string(),
    aboutMd: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  sectionTeachers: defineTable({
    sectionId: v.id('sections'),
    teacherId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_section', ['sectionId'])
    .index('by_teacher', ['teacherId']),

  sectionStudents: defineTable({
    sectionId: v.id('sections'),
    studentId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_section', ['sectionId'])
    .index('by_student', ['studentId']),

  activities: defineTable({
    sectionId: v.id('sections'),
    title: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    type: v.union(v.literal('exam'), v.literal('class'), v.literal('assignment')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_section', ['sectionId']),

  problems: defineTable({
    createdBy: v.id('users'),
    title: v.string(),
    contentMd: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_creator', ['createdBy']),

  activityProblems: defineTable({
    activityId: v.id('activities'),
    problemId: v.id('problems'),
    problemOrder: v.number(),
    createdAt: v.number(),
  })
    .index('by_activity', ['activityId'])
    .index('by_problem', ['problemId']),

  problemIos: defineTable({
    problemId: v.id('problems'),
    inputData: v.string(),
    outputData: v.string(),
    ioOrder: v.number(),
  }).index('by_problem', ['problemId']),

  snapshots: defineTable({
    authorId: v.id('users'),
    problemId: v.id('problems'),
    activityId: v.id('activities'),
    timestamp: v.number(),
    content: v.string(),
    languageId: v.optional(v.number()),
  })
    .index('by_author', ['authorId'])
    .index('by_activity_problem', ['activityId', 'problemId'])
    .index('by_author_activity_problem', ['authorId', 'activityId', 'problemId']),

  submissions: defineTable({
    authorId: v.id('users'),
    problemId: v.id('problems'),
    activityId: v.id('activities'),
    content: v.string(),
    languageId: v.optional(v.number()),
    judgeVerdict: v.optional(v.string()),
    submittedAt: v.number(),
  })
    .index('by_author', ['authorId'])
    .index('by_activity', ['activityId'])
    .index('by_activity_problem', ['activityId', 'problemId'])
    .index('by_author_activity_problem', ['authorId', 'activityId', 'problemId']),

  chats: defineTable({
    name: v.string(),
    createdAt: v.number(),
  }),

  chatMembers: defineTable({
    chatId: v.id('chats'),
    userId: v.id('users'),
    joinedAt: v.number(),
  })
    .index('by_chat', ['chatId'])
    .index('by_user', ['userId']),

  messages: defineTable({
    chatId: v.id('chats'),
    senderId: v.id('users'),
    content: v.string(),
    sentAt: v.number(),
  }).index('by_chat', ['chatId']),

  posts: defineTable({
    authorId: v.id('users'),
    contentMd: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_author', ['authorId']),

  tags: defineTable({
    name: v.string(),
  }).index('by_name', ['name']),

  postTags: defineTable({
    postId: v.id('posts'),
    tagId: v.id('tags'),
  })
    .index('by_post', ['postId'])
    .index('by_tag', ['tagId']),

  comments: defineTable({
    authorId: v.id('users'),
    postId: v.id('posts'),
    parentCommentId: v.optional(v.id('comments')),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_parent', ['parentCommentId']),
});

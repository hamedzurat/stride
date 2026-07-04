import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  signals: defineTable({
    from: v.string(), // studentId
    to: v.string(), // "teacher" or studentId
    type: v.string(), // "offer" | "answer" | "ice"
    data: v.string(), // JSON stringified
  }).index('by_to', ['to']),

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
    type: v.union(v.literal('exam'), v.literal('class')),
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
    lastReadAt: v.optional(v.number()),
  })
    .index('by_chat', ['chatId'])
    .index('by_user', ['userId']),

  messages: defineTable({
    chatId: v.id('chats'),
    senderId: v.id('users'),
    content: v.string(),
    sentAt: v.number(),
    imageStorageId: v.optional(v.id('_storage')),
    replyToId: v.optional(v.id('messages')),
  })
    .index('by_chat', ['chatId'])
    .index('by_chat_sentAt', ['chatId', 'sentAt']),

  messageReactions: defineTable({
    messageId: v.id('messages'),
    userId: v.id('users'),
    emoji: v.string(),
  })
    .index('by_message', ['messageId'])
    .index('by_message_and_user', ['messageId', 'userId']),

  presence: defineTable({
    userId: v.id('users'),
    lastSeenAt: v.number(),
  }).index('by_user', ['userId']),

  typingIndicators: defineTable({
    chatId: v.id('chats'),
    userId: v.id('users'),
    lastTypingAt: v.number(),
  })
    .index('by_chat', ['chatId'])
    .index('by_chat_and_user', ['chatId', 'userId']),

  posts: defineTable({
    authorId: v.id('users'),
    title: v.string(),
    contentMd: v.string(),
    storageId: v.optional(v.id('_storage')),
    score: v.optional(v.number()),
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
    score: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    deletedBy: v.optional(v.union(v.literal('user'), v.literal('moderator'))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_parent', ['parentCommentId'])
    .index('by_author', ['authorId']),

  postVotes: defineTable({
    postId: v.id('posts'),
    userId: v.id('users'),
    value: v.union(v.literal(1), v.literal(-1)),
  })
    .index('by_post', ['postId'])
    .index('by_user', ['userId'])
    .index('by_post_and_user', ['postId', 'userId']),

  commentVotes: defineTable({
    commentId: v.id('comments'),
    userId: v.id('users'),
    value: v.union(v.literal(1), v.literal(-1)),
  })
    .index('by_comment', ['commentId'])
    .index('by_user', ['userId'])
    .index('by_comment_and_user', ['commentId', 'userId']),

  uploadedImages: defineTable({
    storageId: v.id('_storage'),
    authorId: v.id('users'),
    postId: v.optional(v.id('posts')),
    commentId: v.optional(v.id('comments')),
    aboutUserId: v.optional(v.id('users')),
    sectionId: v.optional(v.id('sections')),
    problemId: v.optional(v.id('problems')),
    isAvatar: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_comment', ['commentId'])
    .index('by_aboutUserId', ['aboutUserId'])
    .index('by_section', ['sectionId'])
    .index('by_problem', ['problemId'])
    .index('by_storage', ['storageId'])
    .index('by_author', ['authorId']),

  sectionResources: defineTable({
    sectionId: v.id('sections'),
    storageId: v.id('_storage'),
    title: v.string(),
    group: v.optional(v.string()),
    uploadedBy: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_section', ['sectionId'])
    .index('by_section_and_group', ['sectionId', 'group']),
});

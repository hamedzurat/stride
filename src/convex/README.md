# Convex Backend — Schema & Mutations

This document serves as the reference for the Convex database schema and server-side API functions (queries, mutations, and internal mutations) used in this application.

All timestamps are stored as epoch milliseconds (`v.number()`).

---

## Database Tables

### 1. users

Represents application accounts across different roles.

| Field          | Type                          | Notes                                            |
| :------------- | :---------------------------- | :----------------------------------------------- |
| `name`         | `string`                      | User display name                                |
| `email`        | `string`                      | Unique identifier used for authentication        |
| `passwordHash` | `string`                      | Hashed password                                  |
| `role`         | `admin \| teacher \| student` | User role for permission scopes                  |
| `aboutMd`      | `string?`                     | Optional markdown "about me" profile description |
| `avatarUrl`    | `string?`                     | Optional avatar image URL                        |
| `createdAt`    | `number`                      | Timestamp when the user was created              |
| `updatedAt`    | `number`                      | Bumps on every profile or password update        |

- **Indexes**:
  - `by_name` on `["name"]`
  - `by_email` on `["email"]`

**Functions** (`users.ts`)

- `get(id)` (Query) → Returns user document by ID
- `login(email, passwordHash)` (Mutation) → Authenticates user and returns basic session details or `null`
- `list()` (Query) → Lists all users in the system
- `listByRole(role)` (Query) → Lists all users matching a specific role
- `create(name, email, passwordHash, role, aboutMd?, avatarUrl?)` (Mutation) → Creates a new user and returns the generated ID
- `updateProfile(id, name?, aboutMd?, avatarUrl?)` (Mutation) → Patches the user profile and bumps `updatedAt`
- `updatePassword(id, passwordHash)` (Mutation) → Patches the user password and bumps `updatedAt`
- `update(id, name?, email?, role?, aboutMd?, avatarUrl?)` (Mutation) → General system update patch for a user
- `remove(id)` (Mutation) → Deletes a user from the system

---

### 2. sections

Represents virtual classrooms or cohorts.

| Field       | Type      | Notes                                               |
| :---------- | :-------- | :-------------------------------------------------- |
| `name`      | `string`  | Classroom/section name (e.g. course title and code) |
| `aboutMd`   | `string?` | Optional markdown description / syllabus details    |
| `createdAt` | `number`  | Timestamp when section was created                  |
| `updatedAt` | `number`  | Bumps on every section update                       |

**Functions** (`sections.ts`)

- `get(id)` (Query) → Returns section document
- `list()` (Query) → Returns all sections
- `create(name, aboutMd?)` (Mutation) → Creates a section
- `update(id, name?, aboutMd?)` (Mutation) → Updates section name and/or description
- `remove(id)` (Mutation) → Deletes the section

---

### 3. sectionTeachers

Join table mapping teachers to sections.

| Field       | Type            | Notes                       |
| :---------- | :-------------- | :-------------------------- |
| `sectionId` | `id → sections` | Classroom reference (FK)    |
| `teacherId` | `id → users`    | Teacher user reference (FK) |
| `createdAt` | `number`        | Enrollment timestamp        |

- **Indexes**:
  - `by_section` on `["sectionId"]`
  - `by_teacher` on `["teacherId"]`

**Functions** (`sections.ts`)

- `addTeacher(sectionId, teacherId)` (Mutation) → Links a teacher to a section (no-op if already linked)
- `removeTeacher(sectionId, teacherId)` (Mutation) → Unlinks a teacher from a section
- `listTeachers(sectionId)` (Query) → Returns all teachers assigned to a section
- `listSectionsByTeacher(teacherId)` (Query) → Returns all sections assigned to a teacher

---

### 4. sectionStudents

Join table mapping students to sections.

| Field       | Type            | Notes                       |
| :---------- | :-------------- | :-------------------------- |
| `sectionId` | `id → sections` | Classroom reference (FK)    |
| `studentId` | `id → users`    | Student user reference (FK) |
| `createdAt` | `number`        | Enrollment timestamp        |

- **Indexes**:
  - `by_section` on `["sectionId"]`
  - `by_student` on `["studentId"]`

**Functions** (`sections.ts`)

- `addStudent(sectionId, studentId)` (Mutation) → Enrolls a student in a section (no-op if already enrolled)
- `removeStudent(sectionId, studentId)` (Mutation) → Disenrolls a student from a section
- `listStudents(sectionId)` (Query) → Returns all students enrolled in a section
- `listSectionsByStudent(studentId)` (Query) → Returns all sections enrolled by a student

---

### 5. activities

Represents assignments, exams, or active coding practice events within a section.

| Field       | Type            | Notes                         |
| :---------- | :-------------- | :---------------------------- |
| `sectionId` | `id → sections` | Classroom reference (FK)      |
| `title`     | `string`        | Activity name or topic        |
| `startTime` | `number`        | Scheduled start time          |
| `endTime`   | `number`        | Scheduled end time / deadline |
| `type`      | `exam \| class` | Activity type category        |
| `createdAt` | `number`        | Creation timestamp            |
| `updatedAt` | `number`        | Bumps on updates              |

- **Indexes**:
  - `by_section` on `["sectionId"]`

**Functions** (`activities.ts`)

- `get(id)` (Query) → Returns activity document
- `listBySection(sectionId)` (Query) → Returns all activities scheduled under a section
- `create(sectionId, title, startTime, endTime, type)` (Mutation) → Creates an activity
- `update(id, title?, startTime?, endTime?, type?)` (Mutation) → Patches activity details
- `remove(id)` (Mutation) → Deletes an activity

---

### 6. problems

Coding assignments or questions created by educators.

| Field       | Type         | Notes                                        |
| :---------- | :----------- | :------------------------------------------- |
| `createdBy` | `id → users` | Creator reference (FK, usually teacher)      |
| `title`     | `string`     | Problem title                                |
| `contentMd` | `string`     | Problem statement and description (Markdown) |
| `createdAt` | `number`     | Creation timestamp                           |
| `updatedAt` | `number`     | Bumps on description edits                   |

- **Indexes**:
  - `by_creator` on `["createdBy"]`

**Functions** (`problems.ts`)

- `get(id)` (Query) → Returns problem details
- `list()` (Query) → Returns all problems
- `listByCreator(createdBy)` (Query) → Returns all problems authored by a specific creator
- `create(createdBy, title, contentMd)` (Mutation) → Creates a problem
- `update(id, title?, contentMd?)` (Mutation) → Patches problem details
- `remove(id)` (Mutation) → Deletes a problem

---

### 7. activityProblems

Join table linking problems to activities, enforcing custom order.

| Field          | Type              | Notes                                              |
| :------------- | :---------------- | :------------------------------------------------- |
| `activityId`   | `id → activities` | Activity reference (FK)                            |
| `problemId`    | `id → problems`   | Problem reference (FK)                             |
| `problemOrder` | `number`          | Sequence index of this problem inside the activity |
| `createdAt`    | `number`          | Timestamp when added                               |

- **Indexes**:
  - `by_activity` on `["activityId"]`
  - `by_problem` on `["problemId"]`

**Functions** (`activities.ts`)

- `addProblem(activityId, problemId, problemOrder)` (Mutation) → Links a problem (no-op if already linked)
- `removeProblem(activityId, problemId)` (Mutation) → Unlinks a problem from an activity
- `reorderProblem(activityId, problemId, problemOrder)` (Mutation) → Re-sequences a problem's order
- `listProblems(activityId)` (Query) → Returns a sorted list of problem documents linked to an activity

---

### 8. problemIos

Input/Output test cases for automated judging.

| Field        | Type            | Notes                                     |
| :----------- | :-------------- | :---------------------------------------- |
| `problemId`  | `id → problems` | Problem reference (FK)                    |
| `inputData`  | `string`        | Test case input                           |
| `outputData` | `string`        | Expected test case output                 |
| `ioOrder`    | `number`        | Execution sequence order of the test case |

- **Indexes**:
  - `by_problem` on `["problemId"]`

**Functions** (`problems.ts`)

- `addIO(problemId, inputData, outputData, ioOrder)` (Mutation) → Adds a test case
- `updateIO(id, inputData?, outputData?, ioOrder?)` (Mutation) → Patches a test case
- `removeIO(id)` (Mutation) → Deletes a test case
- `listIO(problemId)` (Query) → Lists test cases sorted by `ioOrder`

---

### 9. snapshots

Autosave history mapping code increments written by students on a problem inside an activity.

| Field        | Type              | Notes                                           |
| :----------- | :---------------- | :---------------------------------------------- |
| `authorId`   | `id → users`      | Student reference (FK)                          |
| `problemId`  | `id → problems`   | Problem reference (FK)                          |
| `activityId` | `id → activities` | Activity reference (FK)                         |
| `timestamp`  | `number`          | Epoch ms timestamp (immutable)                  |
| `content`    | `string`          | Autosaved code body                             |
| `languageId` | `number?`         | Optional Judge0 programming language identifier |

- **Indexes**:
  - `by_author` on `["authorId"]`
  - `by_activity_problem` on `["activityId", "problemId"]`
  - `by_author_activity_problem` on `["authorId", "activityId", "problemId"]`

**Functions** (`snapshots.ts`)

- `save(authorId, problemId, activityId, content, languageId?)` (Mutation) → Stores a new snapshot
- `getLatest(authorId, activityId, problemId)` (Query) → Returns the most recent snapshot (useful for autosave recovery)
- `listByAuthor(authorId, activityId, problemId)` (Query) → Lists snapshots in ascending chronological order (useful for revision history / code replays)
- `listByActivityProblem(activityId, problemId)` (Query) → Lists snapshots from all participants (teacher grade review view)

---

### 10. submissions

Judged code submissions evaluated against the problem's test cases.

| Field          | Type              | Notes                                                                       |
| :------------- | :---------------- | :-------------------------------------------------------------------------- |
| `authorId`     | `id → users`      | Student reference (FK)                                                      |
| `problemId`    | `id → problems`   | Problem reference (FK)                                                      |
| `activityId`   | `id → activities` | Activity reference (FK)                                                     |
| `content`      | `string`          | Submitted code block                                                        |
| `languageId`   | `number?`         | Judge0 language identifier                                                  |
| `judgeVerdict` | `string?`         | Evaluation outcome (e.g. "Accepted", "Wrong Answer"). Null until evaluated. |
| `submittedAt`  | `number`          | Timestamp of submission                                                     |

- **Indexes**:
  - `by_author` on `["authorId"]`
  - `by_activity` on `["activityId"]`
  - `by_activity_problem` on `["activityId", "problemId"]`
  - `by_author_activity_problem` on `["authorId", "activityId", "problemId"]`

**Functions** (`submissions.ts`)

- `get(id)` (Query) → Returns a submission by ID
- `submit(authorId, problemId, activityId, content, languageId?)` (Mutation) → Creates a submission (sets `submittedAt` to now)
- `setVerdict(id, judgeVerdict)` (Mutation) → Sets evaluation verdict (called after Judge0 sandbox responds)
- `remove(id)` (Mutation) → Deletes a submission record
- `listByActivity(activityId)` (Query) → Lists all submissions made to a specific activity
- `listByActivityProblem(activityId, problemId)` (Query) → Lists submissions for a particular problem inside an activity
- `listByAuthor(authorId, activityId, problemId)` (Query) → Lists a user's submissions descending (newest first)
- `latestByActivityProblem(activityId, problemId)` (Query) → Returns the latest submission per student for scoreboard compilation

---

### 11. chats

Represents chat messaging channels or classrooms.

| Field       | Type     | Notes              |
| :---------- | :------- | :----------------- |
| `name`      | `string` | Chat group name    |
| `createdAt` | `number` | Creation timestamp |

**Functions** (`chats.ts`)

- `get(id)` (Query) → Returns chat details
- `listByUser(userId)` (Query) → Lists all active chat rooms that a user belongs to
- `create(name, memberIds[])` (Mutation) → Creates a new chat room and links all initial users
- `rename(id, name)` (Mutation) → Renames a chat channel
- `remove(id)` (Mutation) → Deletes a chat channel

---

### 12. chatMembers

Join table linking users to chat groups.

| Field      | Type         | Notes                     |
| :--------- | :----------- | :------------------------ |
| `chatId`   | `id → chats` | Chat group reference (FK) |
| `userId`   | `id → users` | User reference (FK)       |
| `joinedAt` | `number`     | Timestamp of join         |

- **Indexes**:
  - `by_chat` on `["chatId"]`
  - `by_user` on `["userId"]`

**Functions** (`chats.ts`)

- `addMember(chatId, userId)` (Mutation) → Joins a user (no-op if already enrolled)
- `removeMember(chatId, userId)` (Mutation) → Parts a user from a chat group
- `listMembers(chatId)` (Query) → Returns all users who are members of the chat group

---

### 13. messages

Individual message entries inside chats.

| Field      | Type         | Notes                 |
| :--------- | :----------- | :-------------------- |
| `chatId`   | `id → chats` | Chat reference (FK)   |
| `senderId` | `id → users` | Sender reference (FK) |
| `content`  | `string`     | Plain text message    |
| `sentAt`   | `number`     | Epoch milliseconds    |

- **Indexes**:
  - `by_chat` on `["chatId"]`

**Functions** (`messages.ts`)

- `send(chatId, senderId, content)` (Mutation) → Inserts a new message (sets `sentAt`)
- `edit(id, content)` (Mutation) → Updates a message's content
- `remove(id)` (Mutation) → Deletes a message
- `listByChat(chatId, limit?)` (Query) → Lists messages in a chat chronologically (ascending)
- `listWithSender(chatId, limit?)` (Query) → Returns messages enriched with the sender's name and DiceBear-rendered avatar URL

---

### 14. posts

Forum discussion topics or updates. Supports rich-text editor, attachments, tag categorization, and voting.

| Field       | Type             | Notes                                                  |
| :---------- | :--------------- | :----------------------------------------------------- |
| `authorId`  | `id → users`     | Author reference (FK)                                  |
| `title`     | `string`         | Thread title                                           |
| `contentMd` | `string`         | Markdown body content                                  |
| `storageId` | `id → _storage?` | Optional file storage ID for cover image / attachments |
| `score`     | `number?`        | Combined vote score (upvotes minus downvotes)          |
| `createdAt` | `number`         | Creation timestamp                                     |
| `updatedAt` | `number`         | Last modified timestamp                                |

- **Indexes**:
  - `by_author` on `["authorId"]`

**Functions** (`posts.ts`)

- `get(id, userId?)` (Query) → Returns a fully enriched post document (resolves author details, `imageUrl`, tags, `commentCount`, `score`, and current user's vote state)
- `list(userId?, tagId?, sortBy?, onlyMyPosts?)` (Query) → Lists and enriches posts with support for sorting (chronological `'new'`, score-based `'top'`, or engagement-based `'hot'`) and filtering by tags or author
- `listByAuthor(authorId, userId?)` (Query) → Returns all post documents authored by a user
- `create(authorId, title, contentMd, storageId?, tagIds?)` (Mutation) → Creates a post, upvotes it by the author, registers tags, and associates rich-text media assets
- `update(id, title?, contentMd?)` (Mutation) → Patches a post and re-associates images
- `vote(postId, userId, value)` (Mutation) → Casts or clears a post vote (value: `1` for upvote, `-1` for downvote, `0` to cancel)
- `remove(id)` (Mutation) → Deletes the post, associated tags, comments, votes, and clean uploads
- `generateUploadUrl()` (Mutation) → Generates a secure upload URL for media attachments
- `createTag(name)` (Mutation) → Registers a tag (no-op if existing)
- `listTags()` (Query) → Lists all tags
- `addTag(postId, tagId)` (Mutation) → Connects a tag to a post
- `removeTag(postId, tagId)` (Mutation) → Disassociates a tag from a post
- `getImageUrl(storageId)` (Query) → Resolves public URL for a file in Convex storage
- `registerUploadedImage(storageId, authorId)` (Mutation) → Pre-registers an image upload before save/publish
- `listUploadedImages()` (Query) → Lists all uploaded image records
- `deleteUploadedImages(storageIds)` (Mutation) → Deletes unlinked uploads from storage
- `cleanupOldPendingImages()` (Internal Mutation) → Background sweeping agent to wipe orphan image uploads

---

### 15. postVotes

Casted votes on posts to manage ranking.

| Field    | Type         | Notes                           |
| :------- | :----------- | :------------------------------ |
| `postId` | `id → posts` | Post reference (FK)             |
| `userId` | `id → users` | User reference (FK)             |
| `value`  | `1 \| -1`    | Upvote (`1`) or Downvote (`-1`) |

- **Indexes**:
  - `by_post` on `["postId"]`
  - `by_user` on `["userId"]`
  - `by_post_and_user` on `["postId", "userId"]`

---

### 16. tags

Topics used to categorize forum threads.

| Field  | Type     | Notes           |
| :----- | :------- | :-------------- |
| `name` | `string` | Unique tag name |

- **Indexes**:
  - `by_name` on `["name"]`

---

### 17. postTags

Join table linking posts to tags.

| Field    | Type         | Notes               |
| :------- | :----------- | :------------------ |
| `postId` | `id → posts` | Post reference (FK) |
| `tagId`  | `id → tags`  | Tag reference (FK)  |

- **Indexes**:
  - `by_post` on `["postId"]`
  - `by_tag` on `["tagId"]`

---

### 18. comments

Threaded forum post comments. Supports tree hierarchy, soft deletions, and upvotes/downvotes.

| Field             | Type                | Notes                                                              |
| :---------------- | :------------------ | :----------------------------------------------------------------- |
| `authorId`        | `id → users`        | Comment author (FK)                                                |
| `postId`          | `id → posts`        | Forum post thread (FK)                                             |
| `parentCommentId` | `id → comments?`    | Optional parent comment ID (FK, null represents top-level comment) |
| `content`         | `string`            | Markdown or HTML comment text                                      |
| `score`           | `number?`           | Total voting score                                                 |
| `isDeleted`       | `boolean?`          | Flag representing soft-deletion                                    |
| `deletedBy`       | `user \| moderator` | Flag indicating who authorized the deletion                        |
| `createdAt`       | `number`            | Creation timestamp                                                 |
| `updatedAt`       | `number`            | Last modified timestamp                                            |

- **Indexes**:
  - `by_post` on `["postId"]`
  - `by_parent` on `["parentCommentId"]`

**Functions** (`comments.ts`)

- `get(id)` (Query) → Returns comment details
- `listAllByPost(postId, userId?)` (Query) → Lists and enriches all comments on a post in a single round-trip (ideal for client-side tree construction)
- `listByPost(postId)` (Query) → Returns only top-level (no parent) comments on a post
- `listReplies(parentCommentId)` (Query) → Returns direct replies under a comment
- `create(authorId, postId, content, parentCommentId?)` (Mutation) → Creates a comment, auto-upvotes it, and registers rich text image attachments
- `update(id, content)` (Mutation) → Updates comment content and associates active images
- `vote(commentId, userId, value)` (Mutation) → Casts or clears a comment vote (`1` up, `-1` down, `0` cancel)
- `remove(id, userId)` (Mutation) → Soft deletes a comment, wiping content and updating deletion flags depending on whether the trigger was the author (`"user"`) or staff (`"moderator"`)

---

### 19. commentVotes

Casted votes on comments.

| Field       | Type            | Notes                           |
| :---------- | :-------------- | :------------------------------ |
| `commentId` | `id → comments` | Comment reference (FK)          |
| `userId`    | `id → users`    | User reference (FK)             |
| `value`     | `1 \| -1`       | Upvote (`1`) or Downvote (`-1`) |

- **Indexes**:
  - `by_comment` on `["commentId"]`
  - `by_user` on `["userId"]`
  - `by_comment_and_user` on `["commentId", "userId"]`

---

### 20. uploadedImages

Asset registry tracking uploads made from rich-text editors prior to saving or publishing. Enables zero-waste garbage collection of unused attachments.

| Field       | Type             | Notes                                                                 |
| :---------- | :--------------- | :-------------------------------------------------------------------- |
| `storageId` | `id → _storage`  | File storage reference                                                |
| `authorId`  | `id → users`     | Uploading user (FK)                                                   |
| `postId`    | `id → posts?`    | Post reference (FK, null if not yet linked to a published post)       |
| `commentId` | `id → comments?` | Comment reference (FK, null if not yet linked to a published comment) |
| `createdAt` | `number`         | Upload timestamp                                                      |

- **Indexes**:
  - `by_post` on `["postId"]`
  - `by_comment` on `["commentId"]`
  - `by_storage` on `["storageId"]`
  - `by_author` on `["authorId"]`

---

## Background Sweepers (Crons)

Configured in `crons.ts`:

- **`cleanup_old_pending_images`**
  - **Interval**: Every 24 hours
  - **Invokes**: `internal.posts.cleanupOldPendingImages`
  - **Action**: Sweeps the `uploadedImages` table and removes assets from Convex `_storage` that are older than 2 hours and have not yet been assigned to a published `postId` or `commentId`.

---

## Seeding

The backend contains a modular seeding script in `seed.ts`:

- **Invokes**: `internal.seed.default`
- **Action**:
  1. Performs a cascade wipe across all 19 database tables.
  2. Seeds administrative, teacher, and student users.
  3. Pre-configures sections, classroom teacher enrollment, and student classrooms.
  4. Seeds programming problems and automated I/O verification suites.
  5. Schedules SPL and DSA activities (classes and midterm exams) populated with problems.
  6. Recreates code snapshot history (progress steps) and evaluated submissions for realism.
  7. Populates community forums with tags, tagged threads, comments, and real-time chat logs.

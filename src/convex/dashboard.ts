import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { query } from './_generated/server';

export const getDashboardData = query({
  args: {
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('teacher'), v.literal('student')),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== args.role) {
      throw new Error('Unauthorized or invalid user role');
    }

    const now = Date.now();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }).reverse();

    if (args.role === 'admin') {
      // 1. Fetch counts
      const users = await ctx.db.query('users').collect();
      const sectionsCount = (await ctx.db.query('sections').collect()).length;
      const problemsCount = (await ctx.db.query('problems').collect()).length;
      const postsCount = (await ctx.db.query('posts').collect()).length;
      const messagesCount = (await ctx.db.query('messages').collect()).length;
      const commentsCount = (await ctx.db.query('comments').collect()).length;
      const activitiesCount = (await ctx.db.query('activities').collect()).length;
      const resourcesCount = (await ctx.db.query('sectionResources').collect()).length;

      const adminCount = users.filter((u) => u.role === 'admin').length;
      const teacherCount = users.filter((u) => u.role === 'teacher').length;
      const studentCount = users.filter((u) => u.role === 'student').length;

      // 2. Fetch recent submissions (take 5)
      const recentSubs = await ctx.db.query('submissions').order('desc').take(5);

      const enrichedRecentSubs = await Promise.all(
        recentSubs.map(async (sub) => {
          const author = await ctx.db.get(sub.authorId);
          const problem = await ctx.db.get(sub.problemId);
          return {
            _id: sub._id,
            studentName: author?.name ?? 'Unknown Student',
            problemTitle: problem?.title ?? 'Unknown Problem',
            judgeVerdict: sub.judgeVerdict ?? 'Pending',
            submittedAt: sub.submittedAt,
            sectionName: 'System',
          };
        }),
      );

      // 3. Fetch recent posts
      const recentPosts = await ctx.db.query('posts').order('desc').take(5);

      const enrichedRecentPosts = await Promise.all(
        recentPosts.map(async (post) => {
          const author = await ctx.db.get(post.authorId);
          return {
            _id: post._id,
            title: post.title,
            authorName: author?.name ?? 'Unknown Author',
            createdAt: post.createdAt,
          };
        }),
      );

      // 4. Fetch last 7 days submissions trend (take 1000)
      const subsForTrend = await ctx.db.query('submissions').order('desc').take(1000);

      const submissionCounts: Record<string, number> = {};
      for (const date of last7Days) {
        submissionCounts[date] = 0;
      }
      for (const sub of subsForTrend) {
        const dateStr = new Date(sub.submittedAt).toISOString().split('T')[0];
        if (dateStr in submissionCounts) {
          submissionCounts[dateStr]++;
        }
      }
      const submissionTrend = last7Days.map((date) => ({
        date,
        count: submissionCounts[date],
      }));

      return {
        role: 'admin' as const,
        stats: {
          totalUsers: users.length,
          totalStudents: studentCount,
          totalTeachers: teacherCount,
          totalAdmins: adminCount,
          totalSections: sectionsCount,
          totalProblems: problemsCount,
          totalPosts: postsCount,
          totalMessages: messagesCount,
          totalComments: commentsCount,
          totalActivities: activitiesCount,
          totalResources: resourcesCount,
        },
        charts: {
          roleDistribution: [
            { name: 'Students', value: studentCount },
            { name: 'Teachers', value: teacherCount },
            { name: 'Admins', value: adminCount },
          ],
          submissionTrend,
          verdictDistribution: [] as { name: string; value: number }[],
        },
        recentSubmissions: enrichedRecentSubs,
        recentPosts: enrichedRecentPosts,
        upcomingActivities: [] as {
          _id: any;
          title: string;
          type: string;
          startTime: number;
          endTime: number;
          sectionName: string;
        }[],
      };
    }

    if (args.role === 'teacher') {
      // 1. Sections taught by teacher
      const sectionTeachers = await ctx.db
        .query('sectionTeachers')
        .withIndex('by_teacher', (q) => q.eq('teacherId', args.userId))
        .collect();
      const sectionIds = sectionTeachers.map((st) => st.sectionId);

      const sections = [];
      const enrolledStudentIds = new Set<string>();

      for (const sectionId of sectionIds) {
        const sec = await ctx.db.get(sectionId);
        if (sec) {
          sections.push(sec);
          const students = await ctx.db
            .query('sectionStudents')
            .withIndex('by_section', (q) => q.eq('sectionId', sectionId))
            .collect();
          for (const s of students) {
            enrolledStudentIds.add(s.studentId);
          }
        }
      }

      // 2. Activities in teacher's sections
      const activities: Doc<'activities'>[] = [];
      for (const sectionId of sectionIds) {
        const acts = await ctx.db
          .query('activities')
          .withIndex('by_section', (q) => q.eq('sectionId', sectionId))
          .collect();
        activities.push(...acts);
      }

      const upcomingActivities = activities
        .filter((act) => act.endTime > now)
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, 5);

      // 3. Submissions in those activities
      const submissions: Doc<'submissions'>[] = [];
      for (const act of activities) {
        const subs = await ctx.db
          .query('submissions')
          .withIndex('by_activity', (q) => q.eq('activityId', act._id))
          .collect();
        submissions.push(...subs);
      }

      // Recent submissions
      const recentTeacherSubs = [...submissions].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5);

      const enrichedRecentTeacherSubs = await Promise.all(
        recentTeacherSubs.map(async (sub) => {
          const student = await ctx.db.get(sub.authorId);
          const problem = await ctx.db.get(sub.problemId);
          const act = await ctx.db.get(sub.activityId);
          const sec = act ? await ctx.db.get(act.sectionId) : null;
          return {
            _id: sub._id,
            studentName: student?.name ?? 'Unknown Student',
            problemTitle: problem?.title ?? 'Unknown Problem',
            judgeVerdict: sub.judgeVerdict ?? 'Pending',
            submittedAt: sub.submittedAt,
            sectionName: sec?.name ?? 'Unknown Section',
          };
        }),
      );

      // 4. Problems created by teacher
      const teacherProblems = await ctx.db
        .query('problems')
        .withIndex('by_creator', (q) => q.eq('createdBy', args.userId))
        .collect();

      // Trend for teacher's student submissions
      const submissionCounts: Record<string, number> = {};
      for (const date of last7Days) {
        submissionCounts[date] = 0;
      }
      for (const sub of submissions) {
        const dateStr = new Date(sub.submittedAt).toISOString().split('T')[0];
        if (dateStr in submissionCounts) {
          submissionCounts[dateStr]++;
        }
      }
      const submissionTrend = last7Days.map((date) => ({
        date,
        count: submissionCounts[date],
      }));

      // Verdict distribution
      const verdictCounts: Record<string, number> = {};
      for (const sub of submissions) {
        const verdict = sub.judgeVerdict ?? 'Pending';
        verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
      }
      const verdictDistribution = Object.entries(verdictCounts).map(([name, value]) => ({
        name,
        value,
      }));

      return {
        role: 'teacher' as const,
        stats: {
          sectionsTaught: sections.length,
          totalStudents: enrolledStudentIds.size,
          totalActivities: activities.length,
          problemsCreated: teacherProblems.length,
          totalSubmissions: submissions.length,
        },
        charts: {
          submissionTrend,
          verdictDistribution,
          roleDistribution: [] as { name: string; value: number }[],
        },
        upcomingActivities: await Promise.all(
          upcomingActivities.map(async (act) => {
            const sec = await ctx.db.get(act.sectionId);
            return {
              _id: act._id,
              title: act.title,
              type: act.type,
              startTime: act.startTime,
              endTime: act.endTime,
              sectionName: sec?.name ?? 'Unknown Section',
            };
          }),
        ),
        recentSubmissions: enrichedRecentTeacherSubs,
        recentPosts: [] as { _id: any; title: string; authorName: string; createdAt: number }[],
      };
    }

    if (args.role === 'student') {
      // 1. Enrolled sections
      const sectionStudents = await ctx.db
        .query('sectionStudents')
        .withIndex('by_student', (q) => q.eq('studentId', args.userId))
        .collect();
      const sectionIds = sectionStudents.map((ss) => ss.sectionId);

      // 2. Upcoming activities in enrolled sections
      const activities: Doc<'activities'>[] = [];
      for (const sectionId of sectionIds) {
        const acts = await ctx.db
          .query('activities')
          .withIndex('by_section', (q) => q.eq('sectionId', sectionId))
          .collect();
        activities.push(...acts);
      }

      const upcomingActivities = activities
        .filter((act) => act.endTime > now)
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, 5);

      // 3. Submissions by student
      const studentSubs = await ctx.db
        .query('submissions')
        .withIndex('by_author', (q) => q.eq('authorId', args.userId))
        .collect();

      const recentStudentSubs = [...studentSubs].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5);

      const enrichedRecentStudentSubs = await Promise.all(
        recentStudentSubs.map(async (sub) => {
          const problem = await ctx.db.get(sub.problemId);
          const act = await ctx.db.get(sub.activityId);
          const sec = act ? await ctx.db.get(act.sectionId) : null;
          return {
            _id: sub._id,
            studentName: user.name,
            problemTitle: problem?.title ?? 'Unknown Problem',
            sectionName: sec?.name ?? 'Unknown Section',
            judgeVerdict: sub.judgeVerdict ?? 'Pending',
            submittedAt: sub.submittedAt,
          };
        }),
      );

      // Trend for student submissions
      const submissionCounts: Record<string, number> = {};
      for (const date of last7Days) {
        submissionCounts[date] = 0;
      }
      for (const sub of studentSubs) {
        const dateStr = new Date(sub.submittedAt).toISOString().split('T')[0];
        if (dateStr in submissionCounts) {
          submissionCounts[dateStr]++;
        }
      }
      const submissionTrend = last7Days.map((date) => ({
        date,
        count: submissionCounts[date],
      }));

      // Verdict breakdown
      const verdictCounts: Record<string, number> = {};
      for (const sub of studentSubs) {
        const verdict = sub.judgeVerdict ?? 'Pending';
        verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
      }
      const verdictDistribution = Object.entries(verdictCounts).map(([name, value]) => ({
        name,
        value,
      }));

      const studentComments = await ctx.db
        .query('comments')
        .withIndex('by_author', (q) => q.eq('authorId', args.userId))
        .collect();

      const studentSnapshots = await ctx.db
        .query('snapshots')
        .withIndex('by_author', (q) => q.eq('authorId', args.userId))
        .collect();

      return {
        role: 'student' as const,
        stats: {
          enrolledSections: sectionIds.length,
          totalSubmissions: studentSubs.length,
          acceptedSubmissions: studentSubs.filter((s) => s.judgeVerdict === 'Accepted').length,
          upcomingActivitiesCount: activities.filter((act) => act.endTime > now).length,
          totalComments: studentComments.length,
          totalSnapshots: studentSnapshots.length,
        },
        charts: {
          submissionTrend,
          verdictDistribution,
          roleDistribution: [] as { name: string; value: number }[],
        },
        upcomingActivities: await Promise.all(
          upcomingActivities.map(async (act) => {
            const sec = await ctx.db.get(act.sectionId);
            return {
              _id: act._id,
              title: act.title,
              type: act.type,
              startTime: act.startTime,
              endTime: act.endTime,
              sectionName: sec?.name ?? 'Unknown Section',
            };
          }),
        ),
        recentSubmissions: enrichedRecentStudentSubs,
        recentPosts: [] as { _id: any; title: string; authorName: string; createdAt: number }[],
      };
    }

    throw new Error('Unrecognized role');
  },
});

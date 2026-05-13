import type { Doc, Id } from '../../convex/_generated/dataModel';

export type UpcomingActivity = Doc<'activities'> & { sectionName: string };
export type RecentSubmission = Doc<'submissions'> & { problemTitle: string; activityTitle: string };
export type ForumHighlight = Doc<'posts'> & { authorName: string; commentCount: number };

export interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
}

export interface SectionPerformance {
  sectionId: string;
  sectionName: string;
  averageScore: number;
  passRate: number;
  totalStudents: number;
  activeActivities: number;
}

export interface AttentionItem {
  _id: string;
  studentName: string;
  studentId: string;
  problemTitle: string;
  reason: 'struggling' | 'late' | 'pending_review';
  description: string;
  timestamp: number;
  severity: 'high' | 'medium' | 'low';
}

export interface TeacherDashboardData {
  sectionPerformance: SectionPerformance[];
  needsAttention: AttentionItem[];
  upcomingActivities: UpcomingActivity[];
}

export interface DashboardMockData {
  quickStats: QuickStat[];
  upcomingActivities: UpcomingActivity[];
  recentSubmissions: RecentSubmission[];
  forumHighlights: ForumHighlight[];
}

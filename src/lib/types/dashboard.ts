import type { Doc, Id } from '../../convex/_generated/dataModel';

export type UpcomingActivity = Doc<'activities'> & { sectionName: string };
export type RecentSubmission = Doc<'submissions'> & { problemTitle: string; activityTitle: string };
export type ForumHighlight = Doc<'posts'> & { authorName: string; commentCount: number };

export interface QuickStat {
  label: string;
  value: number | string;
  icon: string;
}

export interface DashboardMockData {
  quickStats: QuickStat[];
  upcomingActivities: UpcomingActivity[];
  recentSubmissions: RecentSubmission[];
  forumHighlights: ForumHighlight[];
}

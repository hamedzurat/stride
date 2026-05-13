<script lang="ts">
  import { useQuery } from 'convex-svelte';

  import { api } from '$convex/_generated/api.js';

  import ActivityCalendar from '$lib/components/dashboard/activity-calendar.svelte';
  import ForumHighlights from '$lib/components/dashboard/forum-highlights.svelte';
  import NeedsAttention from '$lib/components/dashboard/needs-attention.svelte';
  import PerformanceOverview from '$lib/components/dashboard/performance-overview.svelte';
  import QuickStats from '$lib/components/dashboard/quick-stats.svelte';
  import RecentSubmissions from '$lib/components/dashboard/recent-submissions.svelte';
  import TeacherCalendar from '$lib/components/dashboard/teacher-calendar.svelte';
  import UpcomingActivities from '$lib/components/dashboard/upcoming-activities.svelte';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import dashboardMockRaw from '$lib/data/dashboard-mock.json';
  import teacherDashboardMockRaw from '$lib/data/teacher-dashboard-mock.json';
  import { session } from '$lib/session';
  import type { DashboardMockData, TeacherDashboardData } from '$lib/types/dashboard';

  const dashboardMock = dashboardMockRaw as unknown as DashboardMockData;
  const teacherDashboardMock = teacherDashboardMockRaw as unknown as TeacherDashboardData;

  const userId = $derived($session?.userId);
  const role = $derived($session?.role);

  const userQuery = useQuery(api.users.get, () => (userId ? { id: userId } : 'skip'));
  const studentSectionsQuery = useQuery(api.sections.listSectionsByStudent, () =>
    userId && role === 'student' ? { studentId: userId } : 'skip',
  );
  const teacherSectionsQuery = useQuery(api.sections.listSectionsByTeacher, () =>
    userId && role === 'teacher' ? { teacherId: userId } : 'skip',
  );

  const user = $derived(userQuery.data);
  const sections = $derived(studentSectionsQuery.data || teacherSectionsQuery.data);
  const isLoading = $derived(userQuery.isLoading || studentSectionsQuery.isLoading || teacherSectionsQuery.isLoading);
  // Force rebuild for latest dashboard-mock.json changes
</script>

<div class="flex flex-col gap-8 p-4">
  <!-- Welcome Section -->
  <Card.Root>
    <Card.Content class="flex items-center gap-6 p-6">
      {#if user}
        <Avatar.Root class="h-20 w-20">
          <Avatar.Image src={user.avatarUrl} alt={user.name} />
          <Avatar.Fallback class="text-2xl">{user.name.charAt(0)}</Avatar.Fallback>
        </Avatar.Root>
        <div class="flex flex-col gap-1">
          <h1 class="text-3xl font-bold tracking-tight">Welcome back, {user.name}</h1>
          <div class="flex items-center gap-2">
            <Badge variant="secondary" class="capitalize">{user.role}</Badge>
            <span class="text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>
      {:else if isLoading}
        <Skeleton class="h-20 w-20 rounded-full" />
        <div class="flex flex-col gap-2">
          <Skeleton class="h-8 w-64" />
          <Skeleton class="h-4 w-32" />
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Conditional Dashboard Content -->
  {#if role === 'teacher'}
    <!-- Teacher View -->
    <PerformanceOverview performance={teacherDashboardMock.sectionPerformance} />

    <div class="grid gap-8 lg:grid-cols-3">
      <div class="flex flex-col gap-8 lg:col-span-2">
        <TeacherCalendar activities={teacherDashboardMock.upcomingActivities} />

        <!-- Sections -->
        <div>
          <h2 class="mb-4 text-xl font-bold tracking-tight">Your Sections</h2>
          <div class="grid gap-6 md:grid-cols-2">
            {#if sections}
              {#each sections as section (section?._id)}
                {#if section}
                  <Card.Root class="group transition-all hover:shadow-lg">
                    <Card.Header>
                      <Card.Title class="group-hover:text-primary">{section.name}</Card.Title>
                      <Card.Description class="line-clamp-2">
                        {section.aboutMd || 'No description provided.'}
                      </Card.Description>
                    </Card.Header>
                    <Card.Footer>
                      <a href="/sections/{section?._id}" class="text-sm font-bold text-primary hover:underline">
                        Manage Section →
                      </a>
                    </Card.Footer>
                  </Card.Root>
                {/if}
              {/each}
            {:else if isLoading}
              {#each [0, 1] as i (i)}
                <Skeleton class="h-32 w-full rounded-2xl" />
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div class="flex flex-col gap-8">
        <NeedsAttention items={teacherDashboardMock.needsAttention} />
        <ForumHighlights highlights={dashboardMock.forumHighlights} />
      </div>
    </div>
  {:else}
    <!-- Student View (Default) -->
    <QuickStats stats={dashboardMock.quickStats} />

    <div class="grid gap-8 lg:grid-cols-3">
      <div class="flex flex-col gap-8 lg:col-span-2">
        <ActivityCalendar activities={dashboardMock.upcomingActivities} />
        <div class="grid gap-8 md:grid-cols-2">
          <UpcomingActivities activities={dashboardMock.upcomingActivities} />
          <RecentSubmissions submissions={dashboardMock.recentSubmissions} />
        </div>

        <!-- Sections -->
        <div>
          <h2 class="mb-4 text-xl font-semibold">Your Sections</h2>
          <div class="grid gap-6 md:grid-cols-2">
            {#if sections}
              {#each sections as section (section?._id)}
                {#if section}
                  <Card.Root class="transition-all hover:shadow-md">
                    <Card.Header>
                      <Card.Title>{section.name}</Card.Title>
                      <Card.Description class="line-clamp-2">
                        {section.aboutMd || 'No description provided.'}
                      </Card.Description>
                    </Card.Header>
                    <Card.Footer>
                      <a href="/sections/{section?._id}" class="text-sm font-medium text-primary hover:underline">
                        View Section details →
                      </a>
                    </Card.Footer>
                  </Card.Root>
                {/if}
              {/each}
            {:else if isLoading}
              {#each [0, 1] as i (i)}
                <Skeleton class="h-32 w-full rounded-2xl" />
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-8">
        <ForumHighlights highlights={dashboardMock.forumHighlights} />
      </div>
    </div>
  {/if}
</div>

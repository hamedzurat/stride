<script lang="ts">
  import Activity from '@lucide/svelte/icons/activity';
  import Award from '@lucide/svelte/icons/award';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Calendar from '@lucide/svelte/icons/calendar';
  import Clock from '@lucide/svelte/icons/clock';
  import FileText from '@lucide/svelte/icons/file-text';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Layers from '@lucide/svelte/icons/layers';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Save from '@lucide/svelte/icons/save';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import Users from '@lucide/svelte/icons/users';
  import Zap from '@lucide/svelte/icons/zap';
  import { useQuery } from 'convex-svelte';
  import { ArcChart, AreaChart, BarChart, PieChart } from 'layerchart';
  import { onMount } from 'svelte';

  import { api } from '$convex/_generated/api.js';

  import { PageLayout } from '$lib/components/page/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { session } from '$lib/session';

  // --- Clock logic ---
  let currentTime = $state(new Date());
  let timer: any;

  onMount(() => {
    timer = setInterval(() => {
      currentTime = new Date();
    }, 1000);
    return () => clearInterval(timer);
  });

  const formattedDateTime = $derived(
    currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }),
  );

  // --- User Session ---
  const currentSession = $derived($session);
  const name = $derived(currentSession?.name ?? 'User');
  const role = $derived(currentSession?.role ?? 'student');
  const userId = $derived(currentSession?.userId);

  // --- Fetch Dashboard Data via Convex ---
  // We use svelte 5 runes style by passing a function inside useQuery to keep it reactive if userId or role changes
  const dashboardQuery = $derived.by(() => {
    if (!userId || !role) return null;
    return useQuery(api.dashboard.getDashboardData, { userId, role });
  });

  const dashboardData = $derived(dashboardQuery?.data);
  const isLoading = $derived(dashboardQuery ? dashboardQuery.isLoading : true);

  // --- Theme-aware color palettes ---
  const arcPalette = [
    'var(--color-success)',
    'var(--color-destructive)',
    'var(--color-warning)',
    'var(--color-info)',
    'var(--color-primary)',
    'var(--color-muted-foreground)',
  ];

  const pieColors = [
    'var(--color-chart-1)',
    'var(--color-chart-2)',
    'var(--color-chart-3)',
    'var(--color-chart-4)',
    'var(--color-chart-5)',
    'var(--color-chart-6)',
    'var(--color-chart-7)',
    'var(--color-chart-8)',
  ];

  const coloredRoles = $derived(
    dashboardData?.charts?.roleDistribution?.map((d, i) => ({
      ...d,
      color: pieColors[i % pieColors.length],
    })) ?? [],
  );

  const coloredVerdicts = $derived(
    dashboardData?.charts?.verdictDistribution?.map((d, i) => ({
      ...d,
      color: pieColors[i % pieColors.length],
    })) ?? [],
  );

  // --- ArcChart series builders ---
  const adminArcSeries = $derived(
    dashboardData?.charts?.roleDistribution?.map((d, i) => ({
      key: d.name,
      data: [d],
      color: arcPalette[i % arcPalette.length],
    })) ?? [],
  );

  const teacherArcSeries = $derived(
    dashboardData?.charts?.verdictDistribution?.map((d, i) => ({
      key: d.name,
      data: [d],
      color: arcPalette[i % arcPalette.length],
    })) ?? [],
  );

  const studentArcSeries = $derived(
    dashboardData?.charts?.verdictDistribution?.map((d, i) => ({
      key: d.name,
      data: [d],
      color: arcPalette[i % arcPalette.length],
    })) ?? [],
  );

  const studentSuccessRate = $derived(
    dashboardData?.role === 'student' && dashboardData.stats.totalSubmissions > 0
      ? Math.round((dashboardData.stats.acceptedSubmissions / dashboardData.stats.totalSubmissions) * 100)
      : 0,
  );

  // --- Color-mapped submission trend for bar charts ---
  const coloredTrend = $derived(
    dashboardData?.charts?.submissionTrend?.map((d) => ({
      ...d,
      barColor: d.count > 0 ? 'var(--color-primary)' : 'var(--color-muted)',
    })) ?? [],
  );

  // --- Student computed stats ---
  const studentStreak = $derived(
    dashboardData?.charts?.submissionTrend
      ? (() => {
          let streak = 0;
          for (let i = dashboardData.charts.submissionTrend.length - 1; i >= 0; i--) {
            if (dashboardData.charts.submissionTrend[i].count > 0) streak++;
            else break;
          }
          return streak;
        })()
      : 0,
  );

  const studentWeekTotal = $derived(
    dashboardData?.charts?.submissionTrend
      ? dashboardData.charts.submissionTrend.reduce((sum, d) => sum + d.count, 0)
      : 0,
  );

  // --- Helpers for Formatting ---
  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<PageLayout wide>
  <!-- Top Header Action -->
  <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div>
      <h2 class="text-2xl font-bold tracking-tight text-foreground">Welcome back, {name}</h2>
    </div>
    <!-- Live Clock in Top Right -->
    <div class="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-xs">
      <Clock class="h-4 w-4 animate-pulse text-primary" />
      <span class="font-mono text-xs font-semibold text-muted-foreground">{formattedDateTime}</span>
    </div>
  </div>

  {#if isLoading}
    <!-- Loading skeleton placeholder -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {#each Array(4) as _, i (i)}
        <Card.Root class="border-border bg-card">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-4 w-4 rounded-full" />
          </Card.Header>
          <Card.Content>
            <Skeleton class="mb-1 h-8 w-16" />
            <Skeleton class="h-3 w-32" />
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
    <div class="grid gap-6 md:grid-cols-2">
      <Card.Root class="h-[350px] border-border bg-card">
        <Card.Header><Skeleton class="h-6 w-48" /></Card.Header>
        <Card.Content class="flex h-full items-center justify-center pb-12">
          <Skeleton class="h-48 w-48 rounded-full" />
        </Card.Content>
      </Card.Root>
      <Card.Root class="h-[350px] border-border bg-card">
        <Card.Header><Skeleton class="h-6 w-48" /></Card.Header>
        <Card.Content class="flex h-full items-center justify-center pb-12">
          <Skeleton class="h-48 w-full" />
        </Card.Content>
      </Card.Root>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {#each Array(6) as _, i (i)}
        <Card.Root class="border-border bg-card">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton class="h-4 w-20" />
            <Skeleton class="h-4 w-4 rounded-full" />
          </Card.Header>
          <Card.Content>
            <Skeleton class="mb-1 h-8 w-12" />
            <Skeleton class="h-3 w-28" />
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
    <div class="grid gap-6 md:grid-cols-2">
      <Card.Root class="h-[300px] border-border bg-card">
        <Card.Header><Skeleton class="h-5 w-44" /></Card.Header>
        <Card.Content class="flex h-full items-center justify-center pb-12">
          <div class="flex w-full gap-4 px-4">
            <Skeleton class="h-40 w-1/2 rounded-full" />
            <Skeleton class="h-28 w-28 rounded-full" />
          </div>
        </Card.Content>
      </Card.Root>
      <Card.Root class="h-[300px] border-border bg-card">
        <Card.Header><Skeleton class="h-5 w-32" /></Card.Header>
        <Card.Content class="flex flex-col gap-4 px-4">
          <Skeleton class="h-20 w-full" />
          <Skeleton class="h-16 w-full" />
        </Card.Content>
      </Card.Root>
    </div>
  {:else if dashboardData}
    <!-- Roles UI -->

    <!-- ==================== ADMIN VIEW ==================== -->
    {#if dashboardData.role === 'admin'}
      <!-- Stats Cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Total Students</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><Users class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalStudents}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Enrolled across all sections</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Instructors</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><GraduationCap class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalTeachers}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Faculty members registered</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Academic Sections</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><Layers class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalSections}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Active class sections</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Forum Discussions</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><MessageSquare class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalPosts}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Total discussion threads</p>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Extra Stats Row -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Total Users</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-1), transparent 90%); color: var(--color-chart-1)"
            >
              <Users class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalUsers}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">All registered accounts</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Problems</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-2), transparent 90%); color: var(--color-chart-2)"
            >
              <BookOpen class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalProblems}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Coding problems</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Messages</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-3), transparent 90%); color: var(--color-chart-3)"
            >
              <MessageSquare class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalMessages}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Chat messages sent</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Comments</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-4), transparent 90%); color: var(--color-chart-4)"
            >
              <MessageSquare class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalComments}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Forum comments</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Activities</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-5), transparent 90%); color: var(--color-chart-5)"
            >
              <Calendar class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalActivities}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Labs & exams</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Resources</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-1), transparent 90%); color: var(--color-chart-1)"
            >
              <FileText class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalResources}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Section resources</p>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Charts Section -->
      <div class="grid gap-6 md:grid-cols-2">
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">User Roles Distribution</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Breakdown of Stride system users by role</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.roleDistribution && dashboardData.charts.roleDistribution.length > 0}
              <div class="flex h-[250px] w-full items-center justify-center">
                <PieChart
                  data={coloredRoles}
                  key="name"
                  value="value"
                  c="color"
                  innerRadius={0.6}
                  cornerRadius={4}
                  padAngle={0.02}
                  legend
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No data available
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Submission Volume (Last 7 Days)</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Daily counts of student code submissions</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.submissionTrend && dashboardData.charts.submissionTrend.length > 0}
              <div class="h-[250px] w-full">
                <BarChart data={coloredTrend} x="date" y="count" c="barColor" bandPadding={0.3} />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No submissions recorded
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Additional Charts -->
      <div class="grid gap-6 md:grid-cols-2">
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Submission Volume Over Time</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Trend of student code submissions shown as an area chart</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.submissionTrend && dashboardData.charts.submissionTrend.length > 0}
              <div class="h-[250px] w-full">
                <AreaChart
                  data={dashboardData.charts.submissionTrend}
                  x="date"
                  y="count"
                  height={220}
                  c="var(--color-chart-1)"
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No submissions recorded
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">User Distribution</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Radial breakdown of system users by role</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.roleDistribution && dashboardData.charts.roleDistribution.length > 0 && adminArcSeries.length > 0}
              <div class="flex h-[250px] w-full items-center justify-center">
                <ArcChart
                  data={dashboardData.charts.roleDistribution}
                  value="value"
                  label="name"
                  innerRadius={40}
                  outerRadius={70}
                  height={220}
                  series={adminArcSeries}
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No data available
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Lists Section -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Recent Submissions -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Recent Submissions</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Latest student code evaluation requests</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-0">
            {#if dashboardData.recentSubmissions.length === 0}
              <div class="p-6 text-center text-xs text-muted-foreground">No recent submissions</div>
            {:else}
              <div class="divide-y divide-border/40">
                {#each dashboardData.recentSubmissions as sub (sub._id)}
                  <div class="flex items-center justify-between p-4 hover:bg-muted/10">
                    <div class="space-y-1">
                      <p class="text-xs font-bold text-foreground">{sub.problemTitle}</p>
                      <p class="text-[10px] text-muted-foreground">
                        By {sub.studentName} • {formatDate(sub.submittedAt)} at {formatTime(sub.submittedAt)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      class={sub.judgeVerdict === 'Accepted'
                        ? 'border border-success/20 bg-success/10 text-[10px] font-bold text-success'
                        : 'border border-destructive/20 bg-destructive/10 text-[10px] font-bold text-destructive'}
                    >
                      {sub.judgeVerdict}
                    </Badge>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Recent Posts -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Active Forum Discussions</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Latest questions posted in the community forum</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-0">
            {#if dashboardData.recentPosts.length === 0}
              <div class="p-6 text-center text-xs text-muted-foreground">No recent forum posts</div>
            {:else}
              <div class="divide-y divide-border/40">
                {#each dashboardData.recentPosts as post (post._id)}
                  <div class="flex items-center justify-between p-4 hover:bg-muted/10">
                    <div class="space-y-1">
                      <p class="max-w-xs truncate text-xs font-bold text-foreground">{post.title}</p>
                      <p class="text-[10px] text-muted-foreground">
                        By {post.authorName} • {formatDate(post.createdAt)}
                      </p>
                    </div>
                    <div class="font-mono text-[10px] text-muted-foreground">{formatTime(post.createdAt)}</div>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- ==================== TEACHER VIEW ==================== -->
    {:else if dashboardData.role === 'teacher'}
      <!-- Stats Cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Sections</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><Layers class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.sectionsTaught}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Sections assigned to you</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Students</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><Users class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalStudents}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Unique enrolled students</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Activities</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><Calendar class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalActivities}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Labs & exams scheduled</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">My Problems</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><BookOpen class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.problemsCreated}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Coding problems authored</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Submissions</Card.Title>
            <div class="rounded-full bg-primary/10 p-1.5 text-primary"><FileText class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalSubmissions}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Student solutions received</p>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Charts Section -->
      <div class="grid gap-6 md:grid-cols-2">
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Submission Verdict breakdown</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Distribution of verdicts for problems in your sections</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.verdictDistribution && dashboardData.charts.verdictDistribution.length > 0}
              <div class="flex h-[250px] w-full items-center justify-center">
                <PieChart
                  data={coloredVerdicts}
                  key="name"
                  value="value"
                  c="color"
                  innerRadius={0.6}
                  cornerRadius={4}
                  padAngle={0.02}
                  legend
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No submissions recorded
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Student Activity (Last 7 Days)</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Daily counts of code submissions from your classes</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.submissionTrend && dashboardData.charts.submissionTrend.length > 0}
              <div class="h-[250px] w-full">
                <BarChart data={coloredTrend} x="date" y="count" c="barColor" bandPadding={0.3} />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No submissions recorded
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Additional Charts -->
      <div class="grid gap-6 md:grid-cols-2">
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Submission Activity Trend</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Daily code submissions from your students shown as an area chart</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.submissionTrend && dashboardData.charts.submissionTrend.length > 0}
              <div class="h-[250px] w-full">
                <AreaChart
                  data={dashboardData.charts.submissionTrend}
                  x="date"
                  y="count"
                  height={220}
                  c="var(--color-chart-1)"
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No submissions recorded
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Verdict Breakdown</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Radial view of submission verdict outcomes</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.verdictDistribution && dashboardData.charts.verdictDistribution.length > 0 && teacherArcSeries.length > 0}
              <div class="flex h-[250px] w-full items-center justify-center">
                <ArcChart
                  data={dashboardData.charts.verdictDistribution}
                  value="value"
                  label="name"
                  innerRadius={40}
                  outerRadius={70}
                  height={220}
                  series={teacherArcSeries}
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No verdicts recorded
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Lists Section -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Upcoming Sessions -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Upcoming Activities</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Scheduled labs and exams for your sections</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-0">
            {#if !dashboardData.upcomingActivities || dashboardData.upcomingActivities.length === 0}
              <div class="p-6 text-center text-xs text-muted-foreground">No upcoming activities scheduled</div>
            {:else}
              <div class="divide-y divide-border/40">
                {#each dashboardData.upcomingActivities as act (act._id)}
                  <div class="flex items-center justify-between p-4 hover:bg-muted/10">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <p class="text-xs font-bold text-foreground">{act.title}</p>
                        <Badge
                          variant="outline"
                          class={act.type === 'exam'
                            ? 'border-destructive/20 bg-destructive/5 text-[9px] font-semibold text-destructive uppercase'
                            : 'border-info/20 bg-info/5 text-[9px] font-semibold text-info uppercase'}
                        >
                          {act.type}
                        </Badge>
                      </div>
                      <p class="text-[10px] text-muted-foreground">{act.sectionName}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs font-semibold text-foreground">{formatDate(act.startTime)}</p>
                      <p class="text-[9px] text-muted-foreground">
                        {formatTime(act.startTime)} - {formatTime(act.endTime)}
                      </p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Student Submissions -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Recent Submissions</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Latest coding solutions submitted by your students</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-0">
            {#if dashboardData.recentSubmissions.length === 0}
              <div class="p-6 text-center text-xs text-muted-foreground">No student submissions yet</div>
            {:else}
              <div class="divide-y divide-border/40">
                {#each dashboardData.recentSubmissions as sub (sub._id)}
                  <div class="flex items-center justify-between p-4 hover:bg-muted/10">
                    <div class="space-y-1">
                      <p class="text-xs font-bold text-foreground">{sub.problemTitle}</p>
                      <p class="text-[10px] text-muted-foreground">
                        By {sub.studentName} • {formatDate(sub.submittedAt)} at {formatTime(sub.submittedAt)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      class={sub.judgeVerdict === 'Accepted'
                        ? 'border border-success/20 bg-success/10 text-[10px] font-bold text-success'
                        : 'border border-destructive/20 bg-destructive/10 text-[10px] font-bold text-destructive'}
                    >
                      {sub.judgeVerdict}
                    </Badge>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- ==================== STUDENT VIEW ==================== -->
    {:else if dashboardData.role === 'student'}
      <!-- Stats Cards -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Enrolled Courses</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-1), transparent 90%); color: var(--color-chart-1)"
            >
              <Layers class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.enrolledSections}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Class sections you attend</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Submissions Made</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-2), transparent 90%); color: var(--color-chart-2)"
            >
              <FileText class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalSubmissions}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Total code files compiled</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Solved Problems</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-3), transparent 90%); color: var(--color-chart-3)"
            >
              <Award class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.acceptedSubmissions}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Accepted verdict submissions</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Upcoming Tasks</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-4), transparent 90%); color: var(--color-chart-4)"
            >
              <Activity class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.upcomingActivitiesCount}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Active labs or exams remaining</p>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Extra Stats Row -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Day Streak</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-5), transparent 90%); color: var(--color-chart-5)"
            >
              <Zap class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-foreground">{studentStreak}</span>
              <span class="text-xs text-muted-foreground">consecutive days</span>
            </div>
            <p class="mt-1 text-[10px] text-muted-foreground">Days with at least one submission</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">This Week</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-1), transparent 90%); color: var(--color-chart-1)"
            >
              <TrendingUp class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-bold text-foreground">{studentWeekTotal}</span>
              <span class="text-xs text-muted-foreground">submissions</span>
            </div>
            <p class="mt-1 text-[10px] text-muted-foreground">Total code submissions this week</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Comments</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-2), transparent 90%); color: var(--color-chart-2)"
            >
              <MessageSquare class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalComments}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Forum comments posted</p>
          </Card.Content>
        </Card.Root>

        <Card.Root class="border-border bg-card transition-all hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Snapshots</Card.Title>
            <div
              class="rounded-full p-1.5"
              style="background: color-mix(in oklch, var(--color-chart-4), transparent 90%); color: var(--color-chart-4)"
            >
              <Save class="h-4 w-4" />
            </div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{dashboardData.stats.totalSnapshots}</div>
            <p class="mt-1 text-[10px] text-muted-foreground">Code snapshots saved</p>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Charts & Activity -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Merged Verdict + Success Rate -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">My Submission Breakdown</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Verdict distribution & overall success rate</Card.Description
            >
          </Card.Header>
          <Card.Content>
            {#if dashboardData.charts.verdictDistribution && dashboardData.charts.verdictDistribution.length > 0}
              <div class="relative flex h-[260px] w-full items-center justify-center">
                <ArcChart
                  data={dashboardData.charts.verdictDistribution}
                  value="value"
                  label="name"
                  innerRadius={65}
                  outerRadius={95}
                  height={240}
                  series={studentArcSeries}
                />
                {#if dashboardData.stats.totalSubmissions > 0}
                  <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-3xl font-bold text-foreground">{studentSuccessRate}%</span>
                    <span class="mt-0.5 text-xs text-muted-foreground">
                      {dashboardData.stats.acceptedSubmissions}/{dashboardData.stats.totalSubmissions}
                    </span>
                    <span class="text-[10px] text-muted-foreground">accepted</span>
                  </div>
                {/if}
              </div>
            {:else}
              <div class="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
                No submissions found
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Submissions Activity (Bar + Area stacked vertically) -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Coding Activity</Card.Title>
            <Card.Description class="text-xs text-muted-foreground">Daily submission volume & trend</Card.Description>
          </Card.Header>
          <Card.Content class="space-y-4">
            {#if dashboardData.charts.submissionTrend && dashboardData.charts.submissionTrend.length > 0}
              <div class="h-[140px] w-full">
                <BarChart data={coloredTrend} x="date" y="count" c="barColor" bandPadding={0.3} />
              </div>
              <div class="h-[100px] w-full">
                <AreaChart
                  data={dashboardData.charts.submissionTrend}
                  x="date"
                  y="count"
                  height={80}
                  c="var(--color-chart-1)"
                />
              </div>
            {:else}
              <div class="flex h-[250px] items-center justify-center text-xs text-muted-foreground">
                No submissions recorded this week
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Lists Section -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Upcoming Sessions -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">Upcoming Labs & Exams</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Scheduled sessions remaining for your courses</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-0">
            {#if !dashboardData.upcomingActivities || dashboardData.upcomingActivities.length === 0}
              <div class="p-6 text-center text-xs text-muted-foreground">No upcoming sessions</div>
            {:else}
              <div class="divide-y divide-border/40">
                {#each dashboardData.upcomingActivities as act (act._id)}
                  <div class="flex items-center justify-between p-4 hover:bg-muted/10">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <p class="text-xs font-bold text-foreground">{act.title}</p>
                        <Badge
                          variant="outline"
                          class={act.type === 'exam'
                            ? 'border-destructive/20 bg-destructive/5 text-[9px] font-semibold text-destructive uppercase'
                            : 'border-info/20 bg-info/5 text-[9px] font-semibold text-info uppercase'}
                        >
                          {act.type}
                        </Badge>
                      </div>
                      <p class="text-[10px] text-muted-foreground">{act.sectionName}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs font-semibold text-foreground">{formatDate(act.startTime)}</p>
                      <p class="text-[9px] text-muted-foreground">
                        {formatTime(act.startTime)} - {formatTime(act.endTime)}
                      </p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Student Submissions -->
        <Card.Root class="border-border bg-card">
          <Card.Header>
            <Card.Title class="text-sm font-bold text-foreground">My Recent Activity</Card.Title>
            <Card.Description class="text-xs text-muted-foreground"
              >Your latest code compilation and evaluation submissions</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-0">
            {#if dashboardData.recentSubmissions.length === 0}
              <div class="p-6 text-center text-xs text-muted-foreground">No recent coding submissions</div>
            {:else}
              <div class="divide-y divide-border/40">
                {#each dashboardData.recentSubmissions as sub (sub._id)}
                  <div class="flex items-center justify-between p-4 hover:bg-muted/10">
                    <div class="space-y-1">
                      <p class="text-xs font-bold text-foreground">{sub.problemTitle}</p>
                      <p class="text-[10px] text-muted-foreground">
                        {sub.sectionName} • {formatDate(sub.submittedAt)} at {formatTime(sub.submittedAt)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      class={sub.judgeVerdict === 'Accepted'
                        ? 'border border-success/20 bg-success/10 text-[10px] font-bold text-success'
                        : 'border border-destructive/20 bg-destructive/10 text-[10px] font-bold text-destructive'}
                    >
                      {sub.judgeVerdict}
                    </Badge>
                  </div>
                {/each}
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    {/if}
  {/if}
</PageLayout>

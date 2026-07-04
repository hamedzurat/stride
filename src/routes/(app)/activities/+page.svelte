<script lang="ts">
  import ActivityIcon from '@lucide/svelte/icons/activity';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlayCircleIcon from '@lucide/svelte/icons/play-circle';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { useConvexClient, useQuery } from 'convex-svelte';
  // Keep now updated every 10 seconds for real-time transitions
  import { onDestroy, onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import { FilterTabs, PageEmpty, PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();

  const userId = $derived($session?.userId);
  const role = $derived($session?.role);

  // Query all activities the user is involved in
  const activitiesQuery = useQuery(api.activities.listAllByUser, () => (userId && role ? { userId, role } : 'skip'));

  const activities = $derived(activitiesQuery.data ?? []);
  const isLoading = $derived(activitiesQuery.isLoading);

  let searchQuery = $state('');
  let filterTab = $state<'all' | 'active' | 'upcoming' | 'past'>('all');

  let now = $state(Date.now());

  let intervalId: any;
  onMount(() => {
    intervalId = setInterval(() => {
      now = Date.now();
    }, 10000);
  });
  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  // Derived filtered list of activities
  const filteredActivities = $derived.by(() => {
    let list = activities;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.sectionName.toLowerCase().includes(q));
    }

    // Tab filter
    if (filterTab === 'active') {
      list = list.filter((a) => a.startTime <= now && now <= a.endTime);
    } else if (filterTab === 'upcoming') {
      list = list.filter((a) => now < a.startTime);
    } else if (filterTab === 'past') {
      list = list.filter((a) => now > a.endTime);
    }

    // Sort by startTime descending
    return [...list].sort((a, b) => b.startTime - a.startTime);
  });

  function getStatus(startTime: number, endTime: number) {
    if (startTime <= now && now <= endTime) return 'active';
    if (now < startTime) return 'upcoming';
    return 'past';
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  function getDurationText(startTime: number, endTime: number) {
    const diff = endTime - startTime;
    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  }

  function getRelativeTimeText(startTime: number, endTime: number, nowVal: number) {
    if (nowVal < startTime) {
      const diff = startTime - nowVal;
      const mins = Math.round(diff / 60000);
      if (mins < 60) return `Starts in ${mins}m`;
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) return `Starts in ${days}d ${hrs % 24}h`;
      return `Starts in ${hrs}h ${mins % 60}m`;
    } else if (nowVal <= endTime) {
      const diff = endTime - nowVal;
      const mins = Math.round(diff / 60000);
      if (mins < 60) return `Ends in ${mins}m`;
      const hrs = Math.floor(mins / 60);
      return `Ends in ${hrs}h ${mins % 60}m`;
    } else {
      const diff = nowVal - endTime;
      const mins = Math.round(diff / 60000);
      if (mins < 60) return `Ended ${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) return `Ended ${days}d ago`;
      return `Ended ${hrs}h ago`;
    }
  }

  async function handleStudentJoin(activityId: Id<'activities'>) {
    try {
      const problems = await client.query(api.activities.listProblems, { activityId });
      if (problems.length > 0 && problems[0].problem) {
        goto(`/activities/${activityId}/${problems[0].problem._id}`);
      } else {
        toast.error('This activity does not have any questions assigned yet.');
      }
    } catch (_err) {
      toast.error('Failed to load activity live room.');
    }
  }
</script>

<PageLayout>
  <!-- Header -->
  <PageHero title="Activities Hub" description="View and manage scheduled classes, exams, and performance reviews.">
    {#snippet actions()}
      {#if role === 'teacher' || role === 'admin'}
        <Button onclick={() => goto('/activities/new')} size="lg" class="font-semibold shadow-sm">
          <PlusIcon class="mr-1.5 size-4" />
          New Activity
        </Button>
      {/if}
    {/snippet}
  </PageHero>

  <!-- Filters & Search -->
  <FilterTabs
    tabs={[
      { label: 'All', value: 'all' },
      { label: 'Active', value: 'active' },
      { label: 'Upcoming', value: 'upcoming' },
      { label: 'Past', value: 'past' },
    ]}
    bind:activeTab={filterTab}
    bind:searchQuery
    placeholder="Search title or section..."
  />

  {#if isLoading}
    <div class="flex flex-col gap-4">
      {#each [0, 1, 2] as i (i)}
        <Card.Root class="overflow-hidden border bg-card shadow-sm transition-all duration-200 hover:shadow-sm">
          <Card.Content class="flex items-center justify-between p-5">
            <div class="flex items-center gap-4">
              <Skeleton class="size-10 rounded-lg" />
              <div class="flex flex-col gap-1.5">
                <Skeleton class="h-5 w-48" />
                <Skeleton class="h-3 w-32" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Skeleton class="h-8 w-20" />
              <Skeleton class="h-8 w-20" />
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {:else if filteredActivities.length === 0}
    <PageEmpty
      icon={CalendarIcon}
      title="No activities found"
      description="There are no activities matching the current filter."
    />
  {:else}
    <div class="flex flex-col gap-4">
      {#each filteredActivities as activity (activity._id)}
        {@const status = getStatus(activity.startTime, activity.endTime)}
        <Card.Root class="border bg-card shadow-sm transition-all duration-200 hover:shadow-sm">
          <Card.Content class="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
            <!-- Left Side: Activity details -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                {#if status === 'active'}
                  <span class="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                    Active
                  </span>
                {:else}
                  <span class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {status === 'upcoming' ? 'Upcoming' : 'Past'}
                  </span>
                {/if}
              </div>
              <h2 class="mt-2 truncate text-lg leading-tight font-bold text-foreground">
                {activity.title}
              </h2>
              <p class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span class="font-semibold text-foreground/80">{activity.sectionName}</span>
                <span class="text-muted-foreground/50">•</span>
                <span>{activity.type === 'exam' ? 'Exam Interface' : 'Class Viewer'}</span>
              </p>
            </div>

            <!-- Middle: Timing Details -->
            <div class="flex min-w-[240px] flex-col gap-1 text-xs text-muted-foreground">
              <div class="flex items-center gap-2">
                <span class="w-10 font-medium text-foreground/75">Start:</span>
                <span>{formatTime(activity.startTime)}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-10 font-medium text-foreground/75">End:</span>
                <span>{formatTime(activity.endTime)}</span>
              </div>
              <div class="mt-1 flex items-center gap-2 text-[11px] font-medium text-primary">
                <span>Duration: {getDurationText(activity.startTime, activity.endTime)}</span>
                <span class="text-muted-foreground/30">•</span>
                <span class="text-muted-foreground"
                  >{getRelativeTimeText(activity.startTime, activity.endTime, now)}</span
                >
              </div>
            </div>

            <!-- Right Side: Action buttons -->
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {#if role === 'teacher' || role === 'admin'}
                <Button size="lg" variant="outline" onclick={() => goto(`/activities/${activity._id}`)}>
                  <ActivityIcon class="mr-1.5 size-3.5" />
                  Status
                </Button>
                <Button size="lg" variant="outline" onclick={() => goto(`/activities/${activity._id}/playback`)}>
                  <PlayCircleIcon class="mr-1.5 size-3.5" />
                  Playback
                </Button>
                <Button size="lg" variant="outline" onclick={() => goto(`/activities/${activity._id}/edit`)}>
                  <PencilIcon class="mr-1.5 size-3.5" />
                  Edit
                </Button>
              {:else if role === 'student'}
                {#if status === 'active'}
                  <Button size="lg" class="font-semibold" onclick={() => handleStudentJoin(activity._id)}>
                    Join Live Room
                  </Button>
                {:else if status === 'upcoming'}
                  <Button size="lg" variant="outline" class="cursor-default" disabled>Starts Soon</Button>
                {:else}
                  <Button size="lg" variant="outline" onclick={() => goto(`/sections/${activity.sectionId}`)}>
                    View Performance
                  </Button>
                {/if}
              {/if}
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</PageLayout>

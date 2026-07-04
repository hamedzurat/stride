<script lang="ts">
  import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SaveIcon from '@lucide/svelte/icons/save';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();

  // Role validation
  onMount(() => {
    if ($session && $session.role !== 'teacher' && $session.role !== 'admin') {
      toast.error('Only teachers and admins can edit activities.');
      goto('/dashboard');
    }
  });

  const activityId = $derived(page.params.activityId as Id<'activities'>);
  const userId = $derived($session?.userId);

  // Queries
  const activityQuery = useQuery(api.activities.get, () => ({ id: activityId }));
  const problemsQuery = useQuery(api.activities.listProblems, () => ({ activityId }));
  const libraryProblemsQuery = useQuery(api.problems.listByCreator, () => (userId ? { createdBy: userId } : 'skip'));

  const activity = $derived(activityQuery.data);
  const currentProblems = $derived(problemsQuery.data ?? []);
  const libraryProblems = $derived(libraryProblemsQuery.data ?? []);

  // Sync settings state
  let title = $state('');
  let activityType = $state<'exam' | 'class'>('class');

  // Date picker states
  let startCalendarDate = $state<any>(undefined);
  let startHour = $state(9);
  let startMinute = $state(0);

  let endCalendarDate = $state<any>(undefined);
  let endHour = $state(11);
  let endMinute = $state(0);

  let initializedDate = $state(false);

  $effect(() => {
    if (activity && !initializedDate) {
      title = activity.title;
      activityType = activity.type;

      const sD = new Date(activity.startTime);
      startCalendarDate = new CalendarDate(sD.getFullYear(), sD.getMonth() + 1, sD.getDate());
      startHour = sD.getHours();
      startMinute = sD.getMinutes();

      const eD = new Date(activity.endTime);
      endCalendarDate = new CalendarDate(eD.getFullYear(), eD.getMonth() + 1, eD.getDate());
      endHour = eD.getHours();
      endMinute = eD.getMinutes();

      initializedDate = true;
    }
  });

  // Deriving timestamps
  const startTime = $derived.by(() => {
    if (!startCalendarDate) return 0;
    const d = startCalendarDate.toDate(getLocalTimeZone());
    d.setHours(startHour);
    d.setMinutes(startMinute);
    return d.getTime();
  });

  const endTime = $derived.by(() => {
    if (!endCalendarDate) return 0;
    const d = endCalendarDate.toDate(getLocalTimeZone());
    d.setHours(endHour);
    d.setMinutes(endMinute);
    return d.getTime();
  });

  // Formatting strings for labels
  const df = new DateFormatter('en-US', { dateStyle: 'medium' });

  const formattedStartTime = $derived.by(() => {
    if (!startCalendarDate) return 'Select date';
    const dateStr = df.format(startCalendarDate.toDate(getLocalTimeZone()));
    const timeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    return `${dateStr} @ ${timeStr}`;
  });

  const formattedEndTime = $derived.by(() => {
    if (!endCalendarDate) return 'Select date';
    const dateStr = df.format(endCalendarDate.toDate(getLocalTimeZone()));
    const timeStr = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    return `${dateStr} @ ${timeStr}`;
  });

  // Settings Actions
  let isSavingSettings = $state(false);
  let isDeletingActivity = $state(false);
  let isRemovingProblem = $state(false);
  let deleteDialogOpen = $state(false);

  async function handleUpdateSettings(e: Event) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title cannot be empty.');
      return;
    }
    if (endTime <= startTime) {
      toast.error('End time must be after start time.');
      return;
    }

    isSavingSettings = true;
    try {
      await client.mutation(api.activities.update, {
        id: activityId,
        title: title.trim(),
        type: activityType,
        startTime,
        endTime,
      });
      toast.success('Activity settings updated successfully!', {
        description: 'Title, schedule, and type have been saved.',
      });
      goto(`/activities/${activityId}`);
    } catch (_err) {
      toast.error('Failed to update activity settings.');
    } finally {
      isSavingSettings = false;
    }
  }

  async function handleDeleteActivity() {
    if (!activity) return;
    isDeletingActivity = true;
    try {
      await client.mutation(api.activities.remove, { id: activityId });
      toast.success('Activity deleted successfully.', {
        description: 'All associated questions and student submissions have been detached.',
      });
      goto(`/sections/${activity.sectionId}`);
    } catch (_err) {
      toast.error('Failed to delete activity.');
    } finally {
      isDeletingActivity = false;
      deleteDialogOpen = false;
    }
  }

  // Problems Actions
  async function handleMoveProblem(index: number, direction: 'up' | 'down') {
    const list = [...currentProblems];
    if (direction === 'up' && index > 0) {
      const p1 = list[index];
      const p2 = list[index - 1];

      await client.mutation(api.activities.reorderProblem, {
        activityId,
        problemId: p1.problemId,
        problemOrder: p2.problemOrder,
      });
      await client.mutation(api.activities.reorderProblem, {
        activityId,
        problemId: p2.problemId,
        problemOrder: p1.problemOrder,
      });
      toast.success('Reordered successfully.');
    } else if (direction === 'down' && index < list.length - 1) {
      const p1 = list[index];
      const p2 = list[index + 1];

      await client.mutation(api.activities.reorderProblem, {
        activityId,
        problemId: p1.problemId,
        problemOrder: p2.problemOrder,
      });
      await client.mutation(api.activities.reorderProblem, {
        activityId,
        problemId: p2.problemId,
        problemOrder: p1.problemOrder,
      });
      toast.success('Reordered successfully.');
    }
  }

  async function handleRemoveProblem(problemId: Id<'problems'>) {
    if (isRemovingProblem) return;
    if (
      !confirm(
        'Are you sure you want to remove this problem from the activity? The problem itself will not be deleted.',
      )
    )
      return;
    isRemovingProblem = true;
    try {
      await client.mutation(api.activities.removeProblem, {
        activityId,
        problemId,
      });

      // Re-index remaining problems to keep sequence contiguous
      const remaining = currentProblems.filter((p) => p.problemId !== problemId);
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].problemOrder !== i) {
          await client.mutation(api.activities.reorderProblem, {
            activityId,
            problemId: remaining[i].problemId,
            problemOrder: i,
          });
        }
      }
      toast.success('Problem detached from activity.');
    } catch (_err) {
      toast.error('Failed to remove problem.');
    } finally {
      isRemovingProblem = false;
    }
  }

  // Attach Problems Panel Search
  let problemSearch = $state('');
  const availableProblems = $derived(
    libraryProblems.filter(
      (p) =>
        !currentProblems.some((cp) => cp.problemId === p._id) &&
        p.title.toLowerCase().includes(problemSearch.toLowerCase()),
    ),
  );

  async function handleAttachProblem(problemId: Id<'problems'>) {
    try {
      await client.mutation(api.activities.addProblem, {
        activityId,
        problemId,
        problemOrder: currentProblems.length,
      });
      toast.success('Problem added to activity.');
    } catch (_err) {
      toast.error('Failed to add problem.');
    }
  }

  const types = [
    { value: 'class', label: 'Class Viewer' },
    { value: 'exam', label: 'Exam Interface' },
  ];
</script>

{#if !activity || !initializedDate}
  <PageLayout>
    <div class="flex flex-col gap-8">
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Skeleton class="h-5 w-36" />
          <Skeleton class="h-3 w-48" />
        </Card.Header>
        <Card.Content class="grid gap-6 p-6">
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
        </Card.Content>
      </Card.Root>
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Skeleton class="h-5 w-36" />
          <Skeleton class="h-3 w-48" />
        </Card.Header>
        <Card.Content class="grid gap-6 p-6">
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
        </Card.Content>
      </Card.Root>
    </div>
  </PageLayout>
{:else}
  <PageLayout>
    <PageHero
      title={'Edit Activity: ' + activity.title}
      description="Modify settings and problems assigned to this activity."
    />

    <div class="flex flex-col gap-8">
      <!-- Card 1: General Details -->
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Card.Title class="text-lg font-bold tracking-tight">General Details</Card.Title>
          <Card.Description>Update schedule times, title, or mode representation.</Card.Description>
        </Card.Header>
        <form onsubmit={handleUpdateSettings}>
          <Card.Content class="grid gap-6 p-6">
            <!-- Title -->
            <div class="flex flex-col gap-2">
              <Label for="title">Activity Title</Label>
              <Input id="title" bind:value={title} required disabled={isSavingSettings} />
            </div>

            <!-- Activity Type -->
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <Label for="type">Activity Type</Label>
                <Select.Root type="single" bind:value={activityType} disabled={isSavingSettings}>
                  <Select.Trigger class="w-full">
                    {types.find((t) => t.value === activityType)?.label ?? 'Select type'}
                  </Select.Trigger>
                  <Select.Content>
                    {#each types as t (t.value)}
                      <Select.Item value={t.value} label={t.label}>{t.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>

              <!-- Dummy spacer to preserve layout balance -->
              <div class="hidden sm:block"></div>

              <!-- Start Time -->
              <div class="flex flex-col gap-2">
                <Label for="startTime">Start Time</Label>
                <Popover.Root>
                  <Popover.Trigger>
                    {#snippet child({ props })}
                      <Button
                        variant="outline"
                        class="w-full justify-start text-left font-normal"
                        {...props}
                        disabled={isSavingSettings}
                      >
                        <CalendarIcon class="mr-2 size-4 opacity-50" />
                        {formattedStartTime}
                      </Button>
                    {/snippet}
                  </Popover.Trigger>
                  <Popover.Content class="w-auto p-0" align="start">
                    <Calendar bind:value={startCalendarDate} type="single" initialFocus />
                    <div class="flex items-center justify-between border-t border-border p-3">
                      <Label class="text-xs font-semibold">Time (24h)</Label>
                      <div class="flex items-center gap-1">
                        <Input type="number" min={0} max={23} bind:value={startHour} class="h-8 w-12 text-center" />
                        <span class="text-muted-foreground">:</span>
                        <Input type="number" min={0} max={59} bind:value={startMinute} class="h-8 w-12 text-center" />
                      </div>
                    </div>
                  </Popover.Content>
                </Popover.Root>
              </div>

              <!-- End Time -->
              <div class="flex flex-col gap-2">
                <Label for="endTime">End Time</Label>
                <Popover.Root>
                  <Popover.Trigger>
                    {#snippet child({ props })}
                      <Button
                        variant="outline"
                        class="w-full justify-start text-left font-normal"
                        {...props}
                        disabled={isSavingSettings}
                      >
                        <CalendarIcon class="mr-2 size-4 opacity-50" />
                        {formattedEndTime}
                      </Button>
                    {/snippet}
                  </Popover.Trigger>
                  <Popover.Content class="w-auto p-0" align="start">
                    <Calendar bind:value={endCalendarDate} type="single" initialFocus />
                    <div class="flex items-center justify-between border-t border-border p-3">
                      <Label class="text-xs font-semibold">Time (24h)</Label>
                      <div class="flex items-center gap-1">
                        <Input type="number" min={0} max={23} bind:value={endHour} class="h-8 w-12 text-center" />
                        <span class="text-muted-foreground">:</span>
                        <Input type="number" min={0} max={59} bind:value={endMinute} class="h-8 w-12 text-center" />
                      </div>
                    </div>
                  </Popover.Content>
                </Popover.Root>
              </div>
            </div>
          </Card.Content>

          <Card.Footer class="flex items-center justify-between border-t bg-muted/5 px-6 py-4">
            <div class="flex items-center gap-2">
              <Button
                variant="destructive"
                type="button"
                onclick={() => (deleteDialogOpen = true)}
                disabled={isSavingSettings || isDeletingActivity}
              >
                <Trash2Icon class="mr-2 size-4" />
                Delete Activity
              </Button>
            </div>
            <Button type="submit" disabled={isSavingSettings || isDeletingActivity}>
              {#if isSavingSettings}
                <Spinner class="mr-2 size-4" />
                Saving...
              {:else}
                <SaveIcon class="mr-2 size-4" />
                Save Settings
              {/if}
            </Button>
          </Card.Footer>
        </form>
      </Card.Root>

      <!-- Card 2: Attached Problems -->
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Card.Title class="text-lg font-bold tracking-tight">Assigned Problems</Card.Title>
          <Card.Description>Manage which coding questions are part of this activity.</Card.Description>
        </Card.Header>
        <Card.Content class="grid gap-6 p-6">
          <!-- Assigned List -->
          <div class="space-y-2">
            <Label>Selected Questions ({currentProblems.length})</Label>
            {#if problemsQuery.isLoading}
              <div class="flex flex-col gap-2">
                <Skeleton class="h-12 w-full" />
                <Skeleton class="h-12 w-full" />
              </div>
            {:else if currentProblems.length === 0}
              <div
                class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/5 py-8 text-center"
              >
                <BookOpenIcon class="mb-2 size-8 text-muted-foreground/30" />
                <p class="text-sm font-medium">No problems attached yet</p>
                <p class="text-xs text-muted-foreground">Search and add questions from your library below.</p>
              </div>
            {:else}
              <div class="divide-y rounded-md border bg-background">
                {#each currentProblems as ap, i (ap._id)}
                  {#if ap.problem}
                    <div class="flex items-center gap-4 px-4 py-3 hover:bg-muted/10">
                      <div
                        class="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted/20 text-xs font-semibold"
                      >
                        {i + 1}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-semibold">{ap.problem.title}</p>
                      </div>
                      <div class="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-8"
                          disabled={i === 0}
                          onclick={() => handleMoveProblem(i, 'up')}
                        >
                          <ArrowUpIcon class="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-8"
                          disabled={i === currentProblems.length - 1}
                          onclick={() => handleMoveProblem(i, 'down')}
                        >
                          <ArrowDownIcon class="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onclick={() => handleRemoveProblem(ap.problemId)}
                          disabled={isRemovingProblem}
                        >
                          {#if isRemovingProblem}
                            <Spinner class="size-4" />
                          {:else}
                            <Trash2Icon class="size-4" />
                          {/if}
                        </Button>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>

          <Separator />

          <!-- Problem Library Search -->
          <div class="space-y-3">
            <div class="flex flex-col gap-2">
              <Label for="librarySearch">Search Your Problem Library</Label>
              <Input
                id="librarySearch"
                placeholder="Type problem title to search..."
                bind:value={problemSearch}
                class="h-9"
              />
            </div>

            {#if libraryProblemsQuery.isLoading}
              <div class="flex flex-col gap-2">
                <Skeleton class="h-10 w-full" />
                <Skeleton class="h-10 w-full" />
              </div>
            {:else if availableProblems.length === 0}
              <p class="py-4 text-center text-xs text-muted-foreground">No matching unassigned problems found.</p>
            {:else}
              <div class="max-h-[250px] divide-y overflow-y-auto rounded-md border bg-background">
                {#each availableProblems as p (p._id)}
                  <div class="flex items-center justify-between gap-4 p-3 hover:bg-muted/10">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-xs font-semibold">{p.title}</p>
                    </div>
                    <Button size="icon-sm" variant="outline" onclick={() => handleAttachProblem(p._id)}>
                      <PlusIcon class="size-3.5" />
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  </PageLayout>
{/if}

<!-- Delete Activity Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone. This will permanently delete the activity
        <span class="font-semibold">{activity?.title}</span> and detach all questions and student submissions.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isDeletingActivity}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={handleDeleteActivity} disabled={isDeletingActivity}>
        {#if isDeletingActivity}
          <Spinner class="mr-2 size-4" />
          Deleting...
        {:else}
          Delete
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<script lang="ts">
  import { DateFormatter, getLocalTimeZone, today } from '@internationalized/date';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SearchIcon from '@lucide/svelte/icons/search';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();

  // Redirect if not authorized
  onMount(() => {
    if ($session && $session.role !== 'teacher' && $session.role !== 'admin') {
      toast.error('Only teachers and admins can create activities.');
      goto('/dashboard');
    }
  });

  const userId = $derived($session?.userId);
  const role = $derived($session?.role);

  // Queries
  const teacherSectionsQuery = useQuery(api.sections.listSectionsByTeacher, () =>
    userId && role === 'teacher' ? { teacherId: userId } : 'skip',
  );
  const allSectionsQuery = useQuery(api.sections.list, () => (userId && role === 'admin' ? {} : 'skip'));
  const libraryProblemsQuery = useQuery(api.problems.listByCreator, () => (userId ? { createdBy: userId } : 'skip'));
  const allActivitiesQuery = useQuery(api.activities.listAllByUser, () =>
    userId && role === 'teacher' ? { userId, role } : 'skip',
  );

  const sections = $derived((role === 'admin' ? allSectionsQuery.data : teacherSectionsQuery.data) ?? []);
  const isSectionsLoading = $derived(role === 'admin' ? allSectionsQuery.isLoading : teacherSectionsQuery.isLoading);
  const libraryProblems = $derived(libraryProblemsQuery.data ?? []);
  const activitiesToClone = $derived(allActivitiesQuery.data ?? []);

  // Read sectionId from query params
  const urlSectionId = $derived(page.url.searchParams.get('sectionId') as Id<'sections'> | null);

  // Form State
  let title = $state('');
  let activityType = $state<'exam' | 'class'>('class');
  let selectedSectionId = $state<string>('');
  let triggerWidth = $state(0);

  // Date picker states
  let startCalendarDate = $state<any>(today(getLocalTimeZone()));
  let startHour = $state(9);
  let startMinute = $state(0);

  let endCalendarDate = $state<any>(today(getLocalTimeZone()));
  let endHour = $state(11);
  let endMinute = $state(0);

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

  // Problems Selection State
  let selectedProblems = $state<any[]>([]);
  let problemSearch = $state('');

  const availableProblems = $derived(
    libraryProblems.filter(
      (p) =>
        !selectedProblems.some((sp) => sp._id === p._id) && p.title.toLowerCase().includes(problemSearch.toLowerCase()),
    ),
  );

  let isSubmitting = $state(false);

  // Pre-select section if passed in URL
  $effect(() => {
    if (urlSectionId) {
      selectedSectionId = urlSectionId;
    } else if (sections.length > 0 && !selectedSectionId) {
      selectedSectionId = sections[0]?._id ?? '';
    }
  });
  const currentSection = $derived(sections.find((s) => s?._id === selectedSectionId));
  // Cloning State & Action
  let selectedCloneActivityName = $state('');
  let cloneSearchQuery = $state('');

  const filteredActivitiesToClone = $derived(
    activitiesToClone.filter((a) => a.title.toLowerCase().includes(cloneSearchQuery.toLowerCase())),
  );

  async function handleCloneSelect(act: any) {
    selectedCloneActivityName = act.title;
    title = act.title;
    activityType = act.type;
    try {
      const clonedProblems = await client.query(api.activities.listProblems, {
        activityId: act._id,
      });
      selectedProblems = clonedProblems.filter((cp) => cp.problem !== null).map((cp) => cp.problem);
      toast.success('Activity details and problems cloned successfully!', {
        description: 'You can adjust the problems before creating the activity.',
      });
    } catch (_err) {
      toast.error('Failed to clone problems from the selected activity.');
    }
  }

  // Problems Actions
  function handleAddProblem(problem: any) {
    selectedProblems = [...selectedProblems, problem];
  }

  function handleRemoveProblem(problemId: string) {
    selectedProblems = selectedProblems.filter((p) => p._id !== problemId);
  }

  function handleMoveProblem(index: number, direction: 'up' | 'down') {
    if (direction === 'up' && index > 0) {
      const list = [...selectedProblems];
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
      selectedProblems = list;
    } else if (direction === 'down' && index < selectedProblems.length - 1) {
      const list = [...selectedProblems];
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
      selectedProblems = list;
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!selectedSectionId) {
      toast.error('Please select a section.');
      return;
    }

    if (endTime <= startTime) {
      toast.error('End time must be after start time.');
      return;
    }

    isSubmitting = true;
    try {
      // 1. Create activity
      const activityId = await client.mutation(api.activities.create, {
        sectionId: selectedSectionId as Id<'sections'>,
        title: title.trim(),
        startTime,
        endTime,
        type: activityType,
      });

      // 2. Attach selected problems in order
      for (let i = 0; i < selectedProblems.length; i++) {
        await client.mutation(api.activities.addProblem, {
          activityId,
          problemId: selectedProblems[i]._id,
          problemOrder: i,
        });
      }

      toast.success('Activity created successfully!', {
        description: `"${title.trim()}" is now scheduled for the selected section.`,
      });
      goto(`/activities/${activityId}`);
    } catch (_err) {
      toast.error('Failed to create activity.');
    } finally {
      isSubmitting = false;
    }
  }

  function handleBack() {
    if (urlSectionId) {
      goto(`/sections/${urlSectionId}`);
    } else {
      goto('/activities');
    }
  }
</script>

<PageLayout>
  <PageHero title="Create New Activity" description="Schedule a class session or exam for your students." />

  <form onsubmit={handleSubmit} class="flex flex-col gap-8">
    <!-- Card 1: Details -->
    <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
      <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
        <Card.Title class="text-lg font-bold tracking-tight">Activity Details</Card.Title>
        <Card.Description>Enter schedule times, select targets, and choose presentation mode.</Card.Description>
      </Card.Header>
      <Card.Content class="grid gap-6 p-6">
        <!-- Clone from Existing Activity -->
        {#if role === 'teacher' && activitiesToClone.length > 0}
          <div class="flex flex-col gap-2">
            <Label>Clone From Existing Activity (Optional)</Label>
            <div bind:clientWidth={triggerWidth} class="w-full">
              <Popover.Root>
                <Popover.Trigger>
                  {#snippet child({ props })}
                    <Button
                      variant="outline"
                      {...props}
                      class="flex w-full items-center justify-between font-normal text-muted-foreground"
                      disabled={isSubmitting}
                    >
                      <span class="truncate"
                        >{selectedCloneActivityName || 'Select an activity to clone details and problems...'}</span
                      >
                      <ChevronsUpDownIcon class="size-4 shrink-0 opacity-50" />
                    </Button>
                  {/snippet}
                </Popover.Trigger>
                <Popover.Content style="width: {triggerWidth}px;" class="p-0" align="start">
                  <div class="flex items-center border-b px-3">
                    <SearchIcon class="mr-2 size-4 shrink-0 opacity-50" />
                    <Input
                      placeholder="Search activities to clone..."
                      bind:value={cloneSearchQuery}
                      class="h-9 w-full border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div class="max-h-[200px] overflow-y-auto p-1">
                    {#if filteredActivitiesToClone.length === 0}
                      <p class="p-2 text-center text-xs text-muted-foreground">No activities found.</p>
                    {:else}
                      {#each filteredActivitiesToClone as act (act._id)}
                        <button
                          type="button"
                          class="flex w-full items-start rounded px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                          onclick={() => handleCloneSelect(act)}
                        >
                          <div class="min-w-0 flex-1">
                            <p class="truncate font-medium">{act.title}</p>
                            <p class="truncate text-[10px] text-muted-foreground">
                              {act.sectionName} ({act.type === 'exam' ? 'Exam' : 'Class'})
                            </p>
                          </div>
                        </button>
                      {/each}
                    {/if}
                  </div>
                </Popover.Content>
              </Popover.Root>
            </div>
          </div>
        {/if}

        <!-- Title -->
        <div class="flex flex-col gap-2">
          <Label for="title">Activity Title</Label>
          <Input
            id="title"
            placeholder="e.g. Midterm Exam 1, Session 3: Arrays"
            bind:value={title}
            required
            disabled={isSubmitting}
          />
        </div>

        <!-- Section Selection -->
        <div class="flex flex-col gap-2">
          <Label for="section">Target Section</Label>
          {#if urlSectionId}
            <Input value={sections.find((s) => s?._id === urlSectionId)?.name ?? ''} disabled class="bg-muted" />
          {:else if isSectionsLoading}
            <Skeleton class="h-10 w-full" />
          {:else if sections.length === 0}
            <div class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              You are not registered to teach any sections. You must be added to a section first.
            </div>
          {:else}
            <Select.Root type="single" bind:value={selectedSectionId} disabled={isSubmitting}>
              <Select.Trigger class="w-full">
                {currentSection?.name ?? 'Select section'}
              </Select.Trigger>
              <Select.Content>
                {#each sections as s (s?._id)}
                  {#if s}
                    <Select.Item value={s._id} label={s.name}>{s.name}</Select.Item>
                  {/if}
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <!-- Activity Type -->
          <div class="flex flex-col gap-2">
            <Label>Activity Type</Label>
            <RadioGroup.Root bind:value={activityType} class="flex h-9 items-center gap-6" disabled={isSubmitting}>
              <div class="flex items-center space-x-2">
                <RadioGroup.Item value="class" id="type-class" />
                <Label for="type-class" class="cursor-pointer text-sm font-normal">Class Viewer</Label>
              </div>
              <div class="flex items-center space-x-2">
                <RadioGroup.Item value="exam" id="type-exam" />
                <Label for="type-exam" class="cursor-pointer text-sm font-normal">Exam Interface</Label>
              </div>
            </RadioGroup.Root>
          </div>

          <!-- Dummy spacer to preserve layout balance -->
          <div class="hidden sm:block"></div>

          <!-- Start Time (Popover Calendar) -->
          <div class="flex flex-col gap-2">
            <Label for="startTime">Start Time</Label>
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <Button
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                    {...props}
                    disabled={isSubmitting}
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

          <!-- End Time (Popover Calendar) -->
          <div class="flex flex-col gap-2">
            <Label for="endTime">End Time</Label>
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <Button
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                    {...props}
                    disabled={isSubmitting}
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
    </Card.Root>

    <!-- Card 2: Problems -->
    <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
      <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
        <Card.Title class="text-lg font-bold tracking-tight">Assigned Problems</Card.Title>
        <Card.Description>Search and attach questions from your problem library.</Card.Description>
      </Card.Header>
      <Card.Content class="grid gap-6 p-6">
        <!-- Assigned List -->
        <div class="space-y-2">
          <Label>Selected Questions ({selectedProblems.length})</Label>
          {#if selectedProblems.length === 0}
            <div
              class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/5 py-8 text-center"
            >
              <BookOpenIcon class="mb-2 size-8 text-muted-foreground/30" />
              <p class="text-sm font-medium">No problems attached yet</p>
              <p class="text-xs text-muted-foreground">Search and add questions from your library below.</p>
            </div>
          {:else}
            <div class="divide-y rounded-md border bg-background">
              {#each selectedProblems as p, i (p._id)}
                <div class="flex items-center gap-4 px-4 py-3 hover:bg-muted/10">
                  <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted/20 text-xs font-semibold"
                  >
                    {i + 1}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold">{p.title}</p>
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
                      disabled={i === selectedProblems.length - 1}
                      onclick={() => handleMoveProblem(i, 'down')}
                    >
                      <ArrowDownIcon class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onclick={() => handleRemoveProblem(p._id)}
                    >
                      <Trash2Icon class="size-4" />
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <Separator />

        <!-- Selection/Search list -->
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
                  <Button size="icon-sm" variant="outline" onclick={() => handleAddProblem(p)}>
                    <PlusIcon class="size-3.5" />
                  </Button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </Card.Content>

      <Card.Footer class="flex justify-end gap-2 border-t px-6 py-4">
        <Button variant="outline" type="button" onclick={handleBack} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || sections.length === 0}>
          {#if isSubmitting}
            <Spinner class="mr-2 size-4" />
            Creating...
          {:else}
            Create Activity
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>
  </form>
</PageLayout>

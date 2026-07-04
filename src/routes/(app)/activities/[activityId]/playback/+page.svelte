<script lang="ts">
  import BookOpenCheckIcon from '@lucide/svelte/icons/book-open-check';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import CodeIcon from '@lucide/svelte/icons/code';
  import UsersIcon from '@lucide/svelte/icons/users';
  import { useQuery } from 'convex-svelte';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import { PageEmpty, PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';

  const activityId = $derived(page.params.activityId as Id<'activities'>);

  const activityQuery = useQuery(api.activities.get, () => ({ id: activityId }));
  const problemsQuery = useQuery(api.activities.listProblems, () => ({ activityId }));
  const studentsQuery = useQuery(api.sections.listStudents, () =>
    activityQuery.data ? { sectionId: activityQuery.data.sectionId } : 'skip',
  );
  const submissionsQuery = useQuery(api.submissions.listByActivity, () => ({ activityId }));

  const activity = $derived(activityQuery.data);
  const problems = $derived(problemsQuery.data ?? []);
  const students = $derived(
    (studentsQuery.data ?? [])
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const submissions = $derived(submissionsQuery.data ?? []);
  const isLoading = $derived(activityQuery.isLoading || problemsQuery.isLoading);
  const firstStudentId = $derived(students.length > 0 ? students[0]._id : null);

  // Count unique students who submitted per problem
  function submittedCount(problemId: Id<'problems'>): number {
    const authors = new Set(submissions.filter((s) => s.problemId === problemId).map((s) => s.authorId));
    return authors.size;
  }
</script>

{#if isLoading}
  <PageLayout>
    <Card.Root>
      <Card.Header class="pb-3">
        <Skeleton class="h-5 w-32" />
      </Card.Header>
      <Separator />
      <Card.Content class="p-0">
        {#each [0, 1, 2] as i (i)}
          {#if i > 0}<Separator />{/if}
          <div class="flex items-center gap-4 px-5 py-4">
            <Skeleton class="size-9 rounded-full" />
            <div class="flex flex-1 flex-col gap-1.5">
              <Skeleton class="h-5 w-48" />
              <Skeleton class="h-4 w-72" />
            </div>
            <Skeleton class="h-8 w-24" />
          </div>
        {/each}
      </Card.Content>
    </Card.Root>
  </PageLayout>
{:else if !activity}
  <PageLayout>
    <PageEmpty icon={BookOpenCheckIcon} title="Activity not found" description="This activity could not be found." />
  </PageLayout>
{:else}
  <PageLayout>
    <PageHero
      title={activity.title}
      description={'Review student code progression · ' + students.length + ' students'}
    />

    <!-- Problems List -->
    {#if problems.length > 0}
      <Card.Root>
        <Card.Header class="pb-3">
          <div class="flex items-center gap-2">
            <BookOpenCheckIcon class="size-4 text-muted-foreground" />
            <Card.Title class="text-base">Problems</Card.Title>
            <Badge variant="secondary" class="ml-auto">{problems.length}</Badge>
          </div>
        </Card.Header>
        <Separator />
        <Card.Content class="p-0">
          {#each problems as ap, i (ap._id)}
            {#if ap.problem}
              {@const submitted = submittedCount(ap.problem._id)}
              {@const total = students.length}
              {@const pct = total > 0 ? Math.round((submitted / total) * 100) : 0}

              {#if i > 0}
                <Separator />
              {/if}

              <div class="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50">
                <!-- Problem number -->
                <div
                  class="flex size-9 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold"
                >
                  {ap.problemOrder + 1}
                </div>

                <!-- Problem info -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="truncate font-medium">{ap.problem.title}</h3>
                  </div>
                  {#if ap.problem.contentMd}
                    <p class="mt-0.5 truncate text-sm text-muted-foreground">
                      {ap.problem.contentMd}
                    </p>
                  {/if}
                </div>

                <!-- Stats -->
                <div class="flex shrink-0 items-center gap-4">
                  <!-- Submissions stat -->
                  <div class="flex items-center gap-1.5 text-sm text-muted-foreground" title="Students who submitted">
                    <UsersIcon class="size-3.5" />
                    <span class="tabular-nums">
                      {submitted}/{total}
                    </span>
                    {#if total > 0}
                      <div class="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                        <div class="h-full rounded-full bg-primary transition-all" style="width: {pct}%"></div>
                      </div>
                    {/if}
                  </div>

                  <!-- Start reviewing button -->
                  {#if firstStudentId}
                    <Button
                      size="sm"
                      variant="outline"
                      class="gap-1.5"
                      onclick={() => goto(`/activities/${activityId}/playback/${ap.problem!._id}/${firstStudentId}`)}
                    >
                      <CodeIcon class="size-3.5" />
                      Review
                      <ChevronRightIcon class="size-3.5" />
                    </Button>
                  {:else if studentsQuery.isLoading}
                    <Skeleton class="h-8 w-24" />
                  {:else}
                    <Badge variant="secondary" class="text-xs">No students</Badge>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </Card.Content>
      </Card.Root>
    {:else if isLoading}
      <Card.Root>
        <Card.Header class="pb-3">
          <Skeleton class="h-5 w-32" />
        </Card.Header>
        <Separator />
        <Card.Content class="p-0">
          {#each [0, 1, 2] as i (i)}
            {#if i > 0}<Separator />{/if}
            <div class="flex items-center gap-4 px-5 py-4">
              <Skeleton class="size-9 rounded-full" />
              <div class="flex flex-1 flex-col gap-1.5">
                <Skeleton class="h-5 w-48" />
                <Skeleton class="h-4 w-72" />
              </div>
              <Skeleton class="h-8 w-24" />
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
    {:else}
      <Card.Root>
        <Card.Content class="flex flex-col items-center justify-center py-16 text-center">
          <BookOpenCheckIcon class="mb-3 size-10 text-muted-foreground/50" />
          <p class="text-lg font-medium text-muted-foreground">No problems found</p>
          <p class="mt-1 text-sm text-muted-foreground">This activity has no problems assigned yet.</p>
        </Card.Content>
      </Card.Root>
    {/if}
  </PageLayout>
{/if}

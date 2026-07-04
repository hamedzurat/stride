<script lang="ts">
  import AwardIcon from '@lucide/svelte/icons/award';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import PlayIcon from '@lucide/svelte/icons/play';
  import UsersIcon from '@lucide/svelte/icons/users';
  import { useQuery } from 'convex-svelte';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import { PageEmpty, PageHero, PageLayout } from '$lib/components/page/index.js';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { session } from '$lib/session';

  // Role validation
  onMount(() => {
    if ($session && $session.role !== 'teacher' && $session.role !== 'admin') {
      toast.error('Only teachers and admins can view activity status.');
      goto('/dashboard');
    }
  });

  const activityId = $derived(page.params.activityId as Id<'activities'>);

  // Queries
  const activityQuery = useQuery(api.activities.get, () => ({ id: activityId }));
  const problemsQuery = useQuery(api.activities.listProblems, () => ({ activityId }));
  const submissionsQuery = useQuery(api.submissions.listByActivity, () => ({ activityId }));

  const activity = $derived(activityQuery.data);
  const problems = $derived(problemsQuery.data ?? []);
  const submissions = $derived(submissionsQuery.data ?? []);

  const studentsQuery = useQuery(api.sections.listStudents, () =>
    activity ? { sectionId: activity.sectionId } : 'skip',
  );
  const students = $derived(
    (studentsQuery.data ?? [])
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const isLoading = $derived(
    activityQuery.isLoading || problemsQuery.isLoading || submissionsQuery.isLoading || studentsQuery.isLoading,
  );

  // Helper to find best submission per student per problem
  function getBestSubmission(studentId: Id<'users'>, problemId: Id<'problems'>) {
    const studentSubs = submissions.filter((s) => s.authorId === studentId && s.problemId === problemId);
    if (studentSubs.length === 0) return null;
    const accepted = studentSubs.find((s) => s.judgeVerdict === 'Accepted');
    if (accepted) return accepted;
    return studentSubs.sort((a, b) => b.submittedAt - a.submittedAt)[0];
  }

  // Solved problems count per student (verdict === 'Accepted')
  function getSolvedCount(studentId: Id<'users'>): number {
    return problems.reduce((acc, ap) => {
      if (!ap.problem) return acc;
      const sub = getBestSubmission(studentId, ap.problem._id);
      return sub?.judgeVerdict === 'Accepted' ? acc + 1 : acc;
    }, 0);
  }

  // Solved percentage for the whole section
  const sectionSolvedAverage = $derived.by(() => {
    if (students.length === 0 || problems.length === 0) return 0;
    const totalPossible = students.length * problems.length;
    let totalSolved = 0;
    for (const student of students) {
      totalSolved += getSolvedCount(student._id);
    }
    return Math.round((totalSolved / totalPossible) * 100);
  });

  // Participation count (students who made at least one submission)
  const participationCount = $derived.by(() => {
    const uniqueSubmitters = new Set(submissions.map((s) => s.authorId));
    return uniqueSubmitters.size;
  });

  // CSV Export Action
  function handleExportCSV() {
    if (students.length === 0) {
      toast.error('No student data to export.');
      return;
    }

    const headers = [
      'Student Name',
      'Email',
      ...problems.map((ap) => ap.problem?.title ?? 'Unknown Problem'),
      'Solved Problems',
      'Total Problems',
    ];

    const rows = students.map((student) => {
      const line = [
        student.name,
        student.email,
        ...problems.map((ap) => {
          if (!ap.problem) return 'N/A';
          const sub = getBestSubmission(student._id, ap.problem._id);
          return sub ? (sub.judgeVerdict ?? 'Submitted') : 'No Submission';
        }),
        getSolvedCount(student._id),
        problems.length,
      ];
      return line.map((val) => `"${val.toString().replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activity?.title ?? 'Activity'}_Status.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Status scoreboard exported as CSV successfully!', {
      description: 'The file has been downloaded to your device.',
    });
  }
</script>

{#if isLoading}
  <PageLayout>
    <div class="grid gap-6 md:grid-cols-3">
      {#each [0, 1, 2] as i (i)}
        <Card.Root>
          <Card.Header class="flex flex-row items-center justify-between pb-2">
            <Skeleton class="h-4 w-28" />
            <Skeleton class="size-4" />
          </Card.Header>
          <Card.Content>
            <Skeleton class="h-8 w-16" />
            <Skeleton class="mt-1 h-3 w-32" />
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
    <Card.Root>
      <Card.Header>
        <Skeleton class="h-5 w-32" />
        <Skeleton class="h-3 w-48" />
      </Card.Header>
      <Separator />
      <Card.Content class="p-0">
        <div class="overflow-x-auto">
          <Table.Root class="w-full min-w-[700px]">
            <Table.Header>
              <Table.Row>
                <Table.Head class="p-4"><Skeleton class="h-4 w-20" /></Table.Head>
                {#each [0, 1, 2] as j (j)}
                  <Table.Head class="p-4"><Skeleton class="mx-auto h-4 w-16" /></Table.Head>
                {/each}
                <Table.Head class="p-4 text-right"><Skeleton class="ml-auto h-4 w-12" /></Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each [0, 1, 2, 3] as i (i)}
                <Table.Row>
                  <Table.Cell class="p-4">
                    <div class="flex items-center gap-2">
                      <Skeleton class="size-8 rounded-full" />
                      <div>
                        <Skeleton class="h-4 w-24" />
                        <Skeleton class="h-3 w-32" />
                      </div>
                    </div>
                  </Table.Cell>
                  {#each [0, 1, 2] as j (j)}
                    <Table.Cell class="p-4 text-center"><Skeleton class="mx-auto h-6 w-16" /></Table.Cell>
                  {/each}
                  <Table.Cell class="p-4 text-right"><Skeleton class="ml-auto h-4 w-8" /></Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </Card.Content>
    </Card.Root>
  </PageLayout>
{:else if !activity}
  <PageLayout>
    <PageEmpty icon={BookOpenIcon} title="Activity not found" description="This activity could not be found." />
  </PageLayout>
{:else}
  <PageLayout>
    <PageHero title={'Status: ' + activity.title} description="Classroom status matrix and student submissions.">
      {#snippet actions()}
        <Button
          variant="outline"
          onclick={() => goto(`/activities/${activityId}/playback`)}
          size="lg"
          class="font-semibold"
        >
          <PlayIcon class="mr-1.5 size-4" />
          Code Playback
        </Button>
        <Button onclick={handleExportCSV} disabled={students.length === 0} size="lg" class="font-semibold shadow-sm">
          <DownloadIcon class="mr-1.5 size-4" />
          Export CSV
        </Button>
      {/snippet}
    </PageHero>

    <!-- Summary Cards -->
    <div class="grid gap-6 md:grid-cols-3">
      <Card.Root>
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium">Students Enrolled</Card.Title>
          <UsersIcon class="size-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          {#if isLoading}
            <Skeleton class="h-8 w-16" />
          {:else}
            <div class="text-2xl font-bold">{students.length}</div>
            <p class="text-xs text-muted-foreground">Active members in this section.</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium">Class Participation</Card.Title>
          <BookOpenIcon class="size-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          {#if isLoading}
            <Skeleton class="h-8 w-16" />
          {:else}
            <div class="text-2xl font-bold">{participationCount} / {students.length}</div>
            <p class="text-xs text-muted-foreground">Students who submitted code.</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium">Section Success Rate</Card.Title>
          <AwardIcon class="size-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          {#if isLoading}
            <Skeleton class="h-8 w-16" />
          {:else}
            <div class="text-2xl font-bold">{sectionSolvedAverage}%</div>
            <p class="text-xs text-muted-foreground">Percentage of total problems solved.</p>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Scoreboard Matrix -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Status Matrix</Card.Title>
        <Card.Description>Click on any student verdict badge to inspect their playback history.</Card.Description>
      </Card.Header>
      <Separator />
      <Card.Content class="p-0">
        <div class="overflow-x-auto">
          <Table.Root class="w-full min-w-[700px]">
            <Table.Header>
              <Table.Row>
                <Table.Head class="w-[200px] p-4">Student</Table.Head>
                {#each problems as ap, idx (ap._id)}
                  <Table.Head
                    class="max-w-[150px] truncate p-4 text-center text-xs font-semibold"
                    title={ap.problem?.title}
                  >
                    P{idx + 1}: {ap.problem?.title}
                  </Table.Head>
                {/each}
                <Table.Head class="w-[120px] p-4 text-right">Solved</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#if isLoading}
                {#each [0, 1, 2, 3] as i (i)}
                  <Table.Row>
                    <Table.Cell class="p-4">
                      <div class="flex items-center gap-2">
                        <Skeleton class="size-8 rounded-full" />
                        <div class="flex flex-col gap-1">
                          <Skeleton class="h-4 w-24" />
                          <Skeleton class="h-3 w-32" />
                        </div>
                      </div>
                    </Table.Cell>
                    {#each problems as ap (ap._id)}
                      <Table.Cell class="p-4 text-center">
                        <Skeleton class="mx-auto h-6 w-16" />
                      </Table.Cell>
                    {/each}
                    <Table.Cell class="p-4 text-right">
                      <Skeleton class="ml-auto h-4 w-8" />
                    </Table.Cell>
                  </Table.Row>
                {/each}
              {:else if students.length === 0}
                <Table.Row>
                  <Table.Cell colspan={problems.length + 2} class="h-24 p-4 text-center text-sm text-muted-foreground">
                    No students enrolled in this section.
                  </Table.Cell>
                </Table.Row>
              {:else}
                {#each students as student (student._id)}
                  <Table.Row>
                    <!-- Student Avatar & Name -->
                    <Table.Cell class="p-4">
                      <div class="flex items-center gap-3">
                        <Avatar.Root class="size-8">
                          <Avatar.Image src={student.avatarUrl} alt={student.name} />
                          <Avatar.Fallback class="text-xs">{student.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                        </Avatar.Root>
                        <div class="flex min-w-0 flex-col">
                          <span class="truncate text-sm font-medium">{student.name}</span>
                          <span class="truncate text-xs text-muted-foreground">{student.email}</span>
                        </div>
                      </div>
                    </Table.Cell>

                    <!-- Problem Cells -->
                    {#each problems as ap (ap._id)}
                      {@const problemId = ap.problemId}
                      {@const sub = getBestSubmission(student._id, problemId)}
                      <Table.Cell class="p-4 text-center">
                        {#if sub}
                          {@const isAccepted = sub.judgeVerdict === 'Accepted'}
                          <a href="/activities/{activityId}/playback/{problemId}/{student._id}" class="inline-block">
                            <Badge variant={isAccepted ? 'success' : 'destructive'} class="cursor-pointer text-xs">
                              {sub.judgeVerdict ?? 'Submitted'}
                            </Badge>
                          </a>
                        {:else}
                          <span class="text-xs text-muted-foreground/50">—</span>
                        {/if}
                      </Table.Cell>
                    {/each}

                    <!-- Summary Cell -->
                    <Table.Cell class="p-4 text-right font-medium">
                      <Badge variant="outline" class="font-semibold tabular-nums">
                        {getSolvedCount(student._id)} / {problems.length}
                      </Badge>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              {/if}
            </Table.Body>
          </Table.Root>
        </div>
      </Card.Content>
    </Card.Root>
  </PageLayout>
{/if}

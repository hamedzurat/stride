<script lang="ts">
  import Calendar from '@lucide/svelte/icons/calendar';
  import Code2 from '@lucide/svelte/icons/code-2';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { toast } from 'svelte-sonner';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import { PageLayout } from '$lib/components/page/index.js';
  import ProblemContent from '$lib/components/problem-content.svelte';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();

  const problemId = $derived(page.params.problemId as Id<'problems'>);

  // Queries
  const problemQuery = useQuery(api.problems.get, () => ({ id: problemId }));
  const testCasesQuery = useQuery(api.problems.listIO, () => ({ problemId }));

  // State
  let deleteDialogOpen = $state(false);
  let isDeleting = $state(false);

  const canManage = $derived.by(() => {
    if (!$session || !problemQuery.data) return false;
    return $session.userId === problemQuery.data.createdBy || $session.role === 'admin';
  });

  const hasAccess = $derived.by(() => {
    if (!$session || !problemQuery.data) return false;
    if ($session.role === 'teacher') {
      return problemQuery.data.createdBy === $session.userId;
    }
    return true;
  });

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function confirmDelete() {
    isDeleting = true;
    try {
      await client.mutation(api.problems.remove, { id: problemId });
      toast.success('Problem deleted successfully.', {
        description: 'This problem and all associated test cases have been removed.',
      });
      goto('/problems');
    } catch (_err) {
      toast.error('Failed to delete problem.');
    } finally {
      isDeleting = false;
      deleteDialogOpen = false;
    }
  }
</script>

<PageLayout>
  {#if canManage}
    <div class="mb-4 flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={() => goto(`/problems/${problemId}/edit`)}
        class="h-8 cursor-pointer gap-1.5 text-xs font-semibold"
      >
        <Pencil class="h-3.5 w-3.5" /> Edit Problem
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={() => (deleteDialogOpen = true)}
        class="h-8 cursor-pointer gap-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
      >
        <Trash2 class="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  {/if}

  {#if problemQuery.isLoading}
    <Card.Root class="border bg-card/45 shadow-sm backdrop-blur-md">
      <Card.Header class="space-y-4 p-6">
        <Skeleton class="h-8 w-3/4 md:h-9" />
        <div class="flex gap-6">
          <Skeleton class="h-4 w-32" />
          <Skeleton class="h-4 w-24" />
        </div>
      </Card.Header>
      <Separator />
      <Card.Content class="p-6">
        <Skeleton class="mb-3 h-4 w-40" />
        <div class="space-y-2">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-5/6" />
          <Skeleton class="h-4 w-4/5" />
          <Skeleton class="h-4 w-3/4" />
        </div>
      </Card.Content>
    </Card.Root>
  {:else if !problemQuery.data}
    <div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-20 text-center">
      <h3 class="text-xl font-bold">Problem not found</h3>
      <p class="text-sm text-muted-foreground">
        The problem you are looking for may have been deleted or does not exist.
      </p>
      <Button size="sm" onclick={() => goto('/problems')}>Return to Problems</Button>
    </div>
  {:else if !hasAccess}
    <div
      class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-destructive/30 py-20 text-center"
    >
      <h3 class="text-xl font-bold text-destructive">Permission Denied</h3>
      <p class="text-sm text-muted-foreground">You do not have permission to view this problem.</p>
      <Button size="sm" onclick={() => goto('/problems')} class="cursor-pointer">Return to Problems</Button>
    </div>
  {:else}
    {@const problem = problemQuery.data}
    <!-- Main Content Card -->
    <Card.Root class="border bg-card/45 shadow-sm backdrop-blur-md">
      <Card.Header class="space-y-4 p-6">
        <!-- Title & Metadata -->
        <div class="space-y-2">
          <h1 class="text-2xl font-black tracking-tight text-foreground md:text-3xl">
            {problem.title}
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <!-- Date -->
          <div class="flex items-center gap-1.5">
            <Calendar class="h-4 w-4" />
            <span>Updated: {formatTime(problem.updatedAt)}</span>
          </div>
        </div>
      </Card.Header>

      <Separator />

      <!-- Description body -->
      <Card.Content>
        <ProblemContent contentMd={problem.contentMd} />
      </Card.Content>
    </Card.Root>

    <!-- Test Cases / IOs Section -->
    <Card.Root class="border bg-card/45 shadow-sm backdrop-blur-md">
      <Card.Header class="p-6 pb-3">
        <Card.Title class="flex items-center gap-2 text-lg font-bold tracking-tight">
          <Code2 class="h-5 w-5 text-primary" /> Test Cases
        </Card.Title>
        <Card.Description>These inputs and outputs will be used to automatically validate submissions.</Card.Description
        >
      </Card.Header>
      <Card.Content class="p-6 pt-0">
        {#if testCasesQuery.isLoading}
          <div class="overflow-x-auto rounded-lg border">
            <Table.Root>
              <Table.Header class="bg-muted/50">
                <Table.Row>
                  <Table.Head class="w-12 text-center">#</Table.Head>
                  <Table.Head>Input</Table.Head>
                  <Table.Head>Expected Output</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each [1, 2, 3] as i (i)}
                  <Table.Row>
                    <Table.Cell class="text-center"><Skeleton class="mx-auto h-4 w-6" /></Table.Cell>
                    <Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
                    <Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {:else if !testCasesQuery.data || testCasesQuery.data.length === 0}
          <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground italic">
            No test cases added yet. Eligible users can add test cases by clicking "Edit Problem".
          </div>
        {:else}
          <div class="overflow-x-auto rounded-lg border">
            <Table.Root>
              <Table.Header class="bg-muted/50">
                <Table.Row>
                  <Table.Head class="w-12 text-center">#</Table.Head>
                  <Table.Head>Input</Table.Head>
                  <Table.Head>Expected Output</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each testCasesQuery.data as io, idx (io._id)}
                  <Table.Row class="hover:bg-muted/30">
                    <Table.Cell class="text-center font-bold text-muted-foreground">{idx + 1}</Table.Cell>
                    <Table.Cell class="font-mono text-xs whitespace-pre-wrap"
                      >{io.inputData || '[Empty Input]'}</Table.Cell
                    >
                    <Table.Cell class="font-mono text-xs whitespace-pre-wrap"
                      >{io.outputData || '[Empty Output]'}</Table.Cell
                    >
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</PageLayout>

<!-- Deletion Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Problem</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete this problem? This action cannot be undone and will delete all associated test
        cases.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
        {#if isDeleting}
          <Spinner class="size-3.5" /> Deleting...
        {:else}
          Delete
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

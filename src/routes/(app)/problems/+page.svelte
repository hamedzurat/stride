<script lang="ts">
  import Calendar from '@lucide/svelte/icons/calendar';
  import Code2 from '@lucide/svelte/icons/code-2';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import { useQuery } from 'convex-svelte';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import { FilterTabs, PageEmpty, PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { session } from '$lib/session';

  // Queries
  const problemsQuery = useQuery(api.problems.list, {});

  // State
  let searchQuery = $state('');
  let activeTab = $state<'all' | 'my'>('all');

  // Filtered problems list
  const filteredProblems = $derived.by(() => {
    if (!problemsQuery.data) return [];
    let list = [...problemsQuery.data];

    // Filter by role: Teachers can ONLY see their own problems
    if ($session) {
      if ($session.role === 'teacher') {
        list = list.filter((p) => p.createdBy === $session.userId);
      } else if ($session.role === 'admin') {
        // Admin can toggle between all and my
        if (activeTab === 'my') {
          list = list.filter((p) => p.createdBy === $session.userId);
        }
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }

    // Sort by newest
    return list.sort((a, b) => b.createdAt - a.createdAt);
  });

  function canManage(createdBy: string) {
    if (!$session) return false;
    return $session.userId === createdBy || $session.role === 'admin' || $session.role === 'teacher';
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<PageLayout>
  <!-- Hero Banner with gradient -->
  <PageHero
    title="Problems"
    description="Browse, manage, and edit programming challenges. Filter, search, and manage inputs/outputs for student submissions."
  >
    {#snippet actions()}
      {#if $session && ($session.role === 'teacher' || $session.role === 'admin')}
        <Button onclick={() => goto('/problems/new')} size="lg" class="font-semibold shadow-sm">
          <Plus class="size-4" /> Create Problem
        </Button>
      {/if}
    {/snippet}
  </PageHero>

  <!-- Filters & Search Bar -->
  {#if $session && $session.role === 'admin'}
    <FilterTabs
      tabs={[
        { label: 'All Problems', value: 'all' },
        { label: 'My Problems', value: 'my' },
      ]}
      bind:activeTab
      bind:searchQuery
      placeholder="Search by title..."
    ></FilterTabs>
  {:else}
    <div class="relative w-full max-w-xs sm:w-64">
      <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        bind:value={searchQuery}
        placeholder="Search by title..."
        class="pl-9 text-xs focus-visible:ring-primary/30"
      />
    </div>
  {/if}

  <!-- Problems Grid -->
  {#if problemsQuery.isLoading}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}
        <Card.Root class="flex flex-col justify-between border border-border bg-card">
          <Card.Header class="pb-3">
            <Skeleton class="h-6 w-3/4" />
            <div class="mt-2 flex flex-col gap-2">
              <Skeleton class="h-3 w-24" />
              <Skeleton class="h-3 w-20" />
            </div>
          </Card.Header>
          <Card.Footer class="border-t border-border/40 bg-muted/5 p-3">
            <Skeleton class="h-9 w-full" />
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>
  {:else if filteredProblems.length === 0}
    <PageEmpty icon={Code2} title="No problems found" description="Try adjusting your filters or search queries." />
  {:else}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each filteredProblems as problem (problem._id)}
        <Card.Root
          class="flex h-full flex-col justify-between border border-border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
        >
          <Card.Header class="pb-3">
            <Card.Title class="line-clamp-1 text-lg font-bold tracking-tight text-foreground">
              {problem.title}
            </Card.Title>
            <div class="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
              <div class="flex items-center gap-1.5">
                <Calendar class="h-3.5 w-3.5 shrink-0" />
                <span>Created: {formatTime(problem.createdAt)}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Code2 class="h-3.5 w-3.5 shrink-0" />
                <span
                  >Test Cases: <span class="font-semibold text-foreground/80">{problem.testCaseCount ?? 0}</span></span
                >
              </div>
            </div>
          </Card.Header>
          <Card.Footer class="flex items-center justify-between gap-2 border-t border-border/40 bg-muted/5 p-3">
            <Button size="lg" class="flex-1 font-semibold" onclick={() => goto(`/problems/${problem._id}`)}>
              View Details
            </Button>
            {#if canManage(problem.createdBy)}
              <div class="flex items-center gap-1">
                <Button href="/problems/{problem._id}/edit" variant="outline" size="icon-lg" title="Edit problem">
                  <Pencil class="size-3.5" />
                </Button>
              </div>
            {/if}
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>
  {/if}
</PageLayout>

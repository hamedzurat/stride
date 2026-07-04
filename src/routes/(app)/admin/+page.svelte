<script lang="ts">
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import Lock from '@lucide/svelte/icons/lock';
  import Search from '@lucide/svelte/icons/search';
  import { useQuery } from 'convex-svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { fade } from 'svelte/transition';

  import { api } from '$convex/_generated/api.js';

  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { session } from '$lib/session';

  const isAdmin = $derived($session && $session.role === 'admin');

  // Strictly allowed tables list
  const tables = [
    { value: 'users', label: 'Users' },
    { value: 'sections', label: 'Sections' },
    { value: 'activities', label: 'Activities' },
    { value: 'problems', label: 'Problems' },
    { value: 'posts', label: 'Forum Posts' },
  ];

  let selectedTable = $state('users');
  let searchVal = $state('');
  let sortColumn = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  // Reset states when table switches
  $effect(() => {
    if (selectedTable) {
      searchVal = '';
      sortColumn = null;
      sortDirection = 'asc';
    }
  });

  // Dynamic fetch (typed to strictly allow the 5 union literals)
  const tableDataQuery = useQuery(api.admin.getTable, () => ({ tableName: selectedTable as any }));

  function isFilteredKey(key: string) {
    const k = key.toLowerCase();
    if (k.startsWith('_')) return true;
    if (k.endsWith('id')) return true;
    return ['id', 'createdat', 'updatedat', 'passwordhash', 'password'].includes(k);
  }

  // Collect columns
  const allColumns = $derived.by(() => {
    const data = tableDataQuery.data || [];
    if (data.length === 0) return [];
    const keysSet = new SvelteSet<string>();
    for (const row of data) {
      for (const key of Object.keys(row)) {
        if (!isFilteredKey(key)) {
          keysSet.add(key);
        }
      }
    }
    return Array.from(keysSet);
  });

  // Filter rows
  const filteredRows = $derived.by(() => {
    const data = tableDataQuery.data || [];
    if (!searchVal.trim()) return data;
    const term = searchVal.toLowerCase();
    return data.filter((row: any) => {
      return Object.entries(row).some(([key, val]) => {
        if (isFilteredKey(key)) return false;
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  });

  // Sort rows
  const sortedRows = $derived.by(() => {
    const rows = [...filteredRows];
    if (!sortColumn) return rows;
    return rows.sort((a: any, b: any) => {
      const valA = a[sortColumn!];
      const valB = b[sortColumn!];
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      let comparison;
      if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else {
        comparison = String(valA).localeCompare(String(valB));
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  function toggleSort(col: string) {
    if (sortColumn === col) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
  }

  function formatCellValue(key: string, val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);

    const k = key.toLowerCase();
    if (
      typeof val === 'number' &&
      (k.endsWith('time') || k.includes('time') || k.endsWith('at') || k.includes('timestamp'))
    ) {
      try {
        if (val > 10000000000) {
          return new Date(val).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
        }
      } catch (_) {
        // fallback
      }
    }
    return String(val);
  }
</script>

{#if !isAdmin}
  <div class="container mx-auto flex h-[70vh] flex-col items-center justify-center gap-4 text-center" in:fade>
    <div class="rounded-full bg-destructive/10 p-4 text-destructive">
      <Lock class="h-8 w-8" />
    </div>
    <h2 class="text-2xl font-black text-destructive">Access Restricted</h2>
    <p class="max-w-md text-sm text-muted-foreground">This panel is only accessible to system administrators.</p>
  </div>
{:else}
  <PageLayout>
    <!-- Header -->
    <PageHero
      title="Database Explorer"
      description="Inspect, query, and search raw Convex tables and relational entities in real-time."
    />

    <!-- Controls -->
    <div class="flex flex-col gap-4 rounded-xl border bg-card/30 p-4 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Choose Table:</span>
        <Select.Root type="single" bind:value={selectedTable}>
          <Select.Trigger class="w-full cursor-pointer border-primary/20 bg-background/50 sm:w-60">
            {tables.find((t) => t.value === selectedTable)?.label ?? 'Select table'}
          </Select.Trigger>
          <Select.Content class="max-h-72 overflow-y-auto bg-background/95 backdrop-blur-md">
            {#each tables as table (table.value)}
              <Select.Item value={table.value} label={table.label}>{table.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <!-- Search filter -->
      <div class="relative w-full max-w-xs">
        <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search row values..."
          class="border-primary/10 bg-background/40 pl-9 text-sm focus-visible:ring-primary/20"
          bind:value={searchVal}
        />
      </div>
    </div>

    <!-- Table content -->
    <Card.Root class="overflow-hidden border bg-card/45 shadow-sm backdrop-blur-md">
      <Card.Content class="p-0">
        <div class="overflow-x-auto">
          <Table.Root>
            <Table.Header>
              <Table.Row class="hover:bg-transparent">
                {#if allColumns.length > 0}
                  {#each allColumns as col (col)}
                    <Table.Head class="px-4 py-3">
                      <button
                        onclick={() => toggleSort(col)}
                        class="flex cursor-pointer items-center gap-1 text-[10px] font-bold tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
                      >
                        {col}
                        <ChevronsUpDown class="h-3.5 w-3.5 text-muted-foreground/60" />
                      </button>
                    </Table.Head>
                  {/each}
                {/if}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#if tableDataQuery.isLoading}
                {#each [1, 2, 3, 4] as i (i)}
                  <Table.Row>
                    {#each [1, 2, 3, 4] as j (j)}
                      <Table.Cell class="px-4 py-3">
                        <Skeleton class="h-4 w-24" />
                      </Table.Cell>
                    {/each}
                  </Table.Row>
                {/each}
              {:else if sortedRows.length === 0}
                <Table.Row>
                  <Table.Cell
                    colspan={Math.max(allColumns.length, 1)}
                    class="py-16 text-center text-xs text-muted-foreground italic"
                  >
                    No records found inside collection "{selectedTable}".
                  </Table.Cell>
                </Table.Row>
              {:else}
                {#each sortedRows as row, i ((row as any)._id ?? i)}
                  {@const rowObj = row as any}
                  <Table.Row class="border-b transition-colors last:border-0 hover:bg-muted/10">
                    {#each allColumns as col (col)}
                      <Table.Cell
                        class="max-w-sm truncate px-4 py-3 font-mono text-xs"
                        title={formatCellValue(col, rowObj[col])}
                      >
                        {#if typeof rowObj[col] === 'boolean'}
                          <Badge
                            variant={rowObj[col] ? 'default' : 'secondary'}
                            class="px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase"
                          >
                            {rowObj[col] ? 'True' : 'False'}
                          </Badge>
                        {:else}
                          {formatCellValue(col, rowObj[col])}
                        {/if}
                      </Table.Cell>
                    {/each}
                  </Table.Row>
                {/each}
              {/if}
            </Table.Body>
          </Table.Root>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Footer summary info -->
    <div class="flex items-center justify-between px-1 text-xs text-muted-foreground">
      <span
        >Showing <strong>{sortedRows.length}</strong> of <strong>{tableDataQuery.data?.length ?? 0}</strong> records</span
      >
      {#if searchVal.trim()}
        <span>Filtered search results</span>
      {/if}
    </div>
  </PageLayout>
{/if}

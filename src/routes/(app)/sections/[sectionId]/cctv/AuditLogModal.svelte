<script lang="ts">
  import BellIcon from '@lucide/svelte/icons/bell';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import XIcon from '@lucide/svelte/icons/x';

  import { deleteEntry, deleteStudentEntries, getEntries, markAsRead, type AuditEntry } from '$lib/audit-log';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';

  let {
    open = $bindable(false),
    studentId = null,
  }: {
    open: boolean;
    studentId: string | null;
  } = $props();

  let now = $state(Date.now());
  let entries = $state<AuditEntry[]>([]);
  let loading = $state(true);

  const filteredEntries = $derived(studentId ? entries.filter((e) => e.studentId === studentId) : entries);

  const studentName = $derived(
    studentId ? (entries.find((e) => e.studentId === studentId)?.studentName ?? 'Unknown') : null,
  );

  const studentUnreadCount = $derived(filteredEntries.filter((e) => !e.read).length);

  async function loadEntries() {
    loading = true;
    entries = await getEntries();
    loading = false;
  }

  async function handleEntryClick(entry: AuditEntry) {
    if (!entry.read && entry.id != null) {
      await markAsRead(entry.id);
      entries = entries.map((e) => (e.id === entry.id ? { ...e, read: true } : e));
    }
  }

  async function handleDeleteEntry(e: MouseEvent, entry: AuditEntry) {
    e.stopPropagation();
    if (entry.id != null) {
      await deleteEntry(entry.id);
      entries = entries.filter((e) => e.id !== entry.id);
    }
  }

  async function handleMarkAllRead() {
    for (const e of filteredEntries) {
      if (!e.read && e.id != null) {
        await markAsRead(e.id);
      }
    }
    entries = entries.map((e) => (studentId && e.studentId === studentId ? { ...e, read: true } : e));
  }

  async function handleClearAll(e: MouseEvent) {
    e.stopPropagation();
    const targetIds = studentId
      ? entries.filter((e) => e.studentId === studentId && e.id != null).map((e) => e.id!)
      : entries.filter((e) => e.id != null).map((e) => e.id!);
    for (const id of targetIds) {
      await deleteEntry(id);
    }
    if (studentId) {
      await deleteStudentEntries(studentId);
    }
    entries = studentId ? entries.filter((e) => e.studentId !== studentId) : [];
  }

  function formatTime(ts: number): string {
    const diff = now - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  function formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function eventLabel(type: string): string {
    switch (type) {
      case 'unfocused':
        return 'Unfocused';
      case 'focus_returned':
        return 'Focus Returned';
      case 'periodic_snapshot':
        return 'Snapshot';
      case 'offline':
        return 'Offline';
      default:
        return type;
    }
  }

  function eventColor(type: string): string {
    switch (type) {
      case 'unfocused':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'focus_returned':
        return 'bg-success/10 text-success border-success/20';
      case 'periodic_snapshot':
        return 'bg-muted/40 text-muted-foreground border-border/40';
      case 'offline':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return '';
    }
  }

  $effect(() => {
    if (open) {
      loadEntries();
    }
  });

  $effect(() => {
    if (!open) return;
    now = Date.now();
    const interval = setInterval(() => {
      now = Date.now();
    }, 30000);
    return () => clearInterval(interval);
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    showCloseButton={false}
    class="flex h-[90vh] max-h-[90vh] w-full max-w-[95vw] flex-col overflow-hidden p-0 sm:max-w-[95vw]"
  >
    <!-- Header -->
    <div class="flex shrink-0 items-center justify-between border-b border-border/40 px-5 py-4">
      <div class="flex items-center gap-2">
        <BellIcon class="size-4 text-muted-foreground" />
        <h2 class="text-sm font-bold">
          {studentName ?? 'Audit Log'}
        </h2>
        {#if studentName}
          <span class="text-[10px] text-muted-foreground/60">
            &mdash; {filteredEntries.length} event{filteredEntries.length !== 1 ? 's' : ''}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        {#if filteredEntries.length > 0}
          {#if studentUnreadCount > 0}
            <button
              onclick={handleMarkAllRead}
              class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/30 bg-card/40 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-success/10 hover:text-success"
            >
              Mark all read
            </button>
          {/if}
          <button
            onclick={(e) => handleClearAll(e)}
            class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/30 bg-card/40 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            Clear all
          </button>
        {/if}
        <Dialog.Close>
          {#snippet child({ props })}
            <Button variant="ghost" size="icon-sm" {...props}>
              <XIcon class="size-4" />
              <span class="sr-only">Close</span>
            </Button>
          {/snippet}
        </Dialog.Close>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4">
      {#if loading}
        <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
      {:else if filteredEntries.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <BellIcon class="mb-3 size-10 text-muted-foreground/40" />
          <p class="text-sm font-medium text-muted-foreground">
            {studentName ? `${studentName} has no audit entries yet` : 'No audit entries yet'}
          </p>
          <p class="mt-1 max-w-xs text-xs text-muted-foreground/60">
            Audit entries will appear here when students switch tabs or lose focus.
          </p>
        </div>
      {:else}
        <div class="mx-auto max-w-7xl space-y-3">
          {#each filteredEntries as entry (entry.id)}
            <div
              class="overflow-hidden rounded-xl border transition-all duration-200 hover:bg-muted/20 {entry.read
                ? 'border-border/30 bg-card/20'
                : 'border-destructive/20 bg-destructive/5 ring-1 ring-destructive/20'}"
            >
              <div class="flex items-start gap-3 p-3">
                <div class="mt-1 shrink-0">
                  {#if entry.read}
                    <div class="size-2 rounded-full bg-muted-foreground/30"></div>
                  {:else}
                    <div class="size-2 rounded-full bg-destructive"></div>
                  {/if}
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase {eventColor(
                          entry.eventType,
                        )}"
                      >
                        {eventLabel(entry.eventType)}
                      </span>
                      {#if !studentId}
                        <span class="text-xs font-medium text-muted-foreground/70">
                          {entry.studentName}
                        </span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="shrink-0 text-[10px] text-muted-foreground/50">{formatDate(entry.timestamp)}</span>
                      <span class="shrink-0 text-[10px] text-muted-foreground/40">({formatTime(entry.timestamp)})</span>
                    </div>
                  </div>

                  {#if entry.screenshot}
                    <div
                      class="mt-2 cursor-pointer overflow-hidden rounded-lg border border-border/30 transition-all duration-200 hover:ring-1 hover:ring-primary/50"
                      onclick={() => handleEntryClick(entry)}
                      onkeydown={(e) => e.key === 'Enter' && handleEntryClick(entry)}
                      role="button"
                      tabindex="0"
                    >
                      <img
                        src={entry.screenshot}
                        alt="Screenshot"
                        class="w-full object-contain"
                        style="max-height: 400px;"
                      />
                    </div>
                  {/if}
                </div>

                <button
                  onclick={(e) => handleDeleteEntry(e, entry)}
                  class="mt-1 flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-1 text-muted-foreground/50 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                  title="Delete entry"
                >
                  <XIcon class="size-3" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>

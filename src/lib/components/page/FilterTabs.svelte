<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import gsap from 'gsap';

  import { Input } from '$lib/components/ui/input/index.js';

  let {
    tabs,
    activeTab = $bindable(),
    searchQuery = $bindable(),
    placeholder = 'Search...',
    actions,
  }: {
    tabs: { label: string; value: string }[];
    activeTab: string;
    searchQuery?: string;
    placeholder?: string;
    actions?: import('svelte').Snippet;
  } = $props();

  let tablistRef: HTMLDivElement;
  let indicatorRef: HTMLDivElement;
  let firstRun = true;

  function moveIndicator(instant = false) {
    const btns = tablistRef?.querySelectorAll<HTMLElement>('[role="tab"]');
    if (!btns || !indicatorRef) return;
    const idx = tabs.findIndex((t) => t.value === activeTab);
    if (idx === -1) return;
    const btn = btns[idx];
    if (!btn) return;

    if (instant) {
      gsap.set(indicatorRef, { x: btn.offsetLeft, width: btn.offsetWidth });
    } else {
      gsap.to(indicatorRef, {
        x: btn.offsetLeft,
        width: btn.offsetWidth,
        duration: 0.35,
        ease: 'power3.out',
      });
    }
  }

  $effect(() => {
    void activeTab;
    void tabs;
    if (tablistRef && indicatorRef) {
      if (firstRun) {
        moveIndicator(true);
        firstRun = false;
      } else {
        moveIndicator(false);
      }
    }
  });
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div
    bind:this={tablistRef}
    class="relative flex items-center gap-1.5 rounded-lg border bg-muted/20 p-1"
    role="tablist"
  >
    <div
      bind:this={indicatorRef}
      class="pointer-events-none absolute inset-y-1 left-0 rounded-md bg-card shadow-sm"
    ></div>
    {#each tabs as tab (tab.value)}
      <button
        onclick={() => (activeTab = tab.value)}
        role="tab"
        aria-selected={activeTab === tab.value}
        class="relative z-10 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors {activeTab ===
        tab.value
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'}"
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="flex items-center gap-3">
    {#if searchQuery !== undefined}
      <div class="relative w-full max-w-xs sm:w-64">
        <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input bind:value={searchQuery} {placeholder} class="pl-9 text-xs focus-visible:ring-primary/30" />
      </div>
    {/if}
    {#if actions}
      {@render actions()}
    {/if}
  </div>
</div>

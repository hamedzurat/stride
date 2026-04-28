<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A component that handles component interpolation in translated strings.
   * Use tokens like [[token_name]] in your translation strings.
   */
  let { text, map }: { text: string; map: Record<string, Snippet> } = $props();

  const parts = $derived(text.split(/(\[\[.*?\]\])/).filter(Boolean));
</script>

{#each parts as part, i (i)}
  {#if part.startsWith('[[') && part.endsWith(']]')}
    {@render map[part]?.()}
  {:else}
    {part}
  {/if}
{/each}

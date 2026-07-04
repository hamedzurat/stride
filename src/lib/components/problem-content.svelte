<script lang="ts">
  import DOMPurify from 'isomorphic-dompurify';
  // @ts-expect-error - katex does not ship mjs typings for auto-render
  import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';

  let {
    title,
    contentMd,
    class: className = '',
    children,
  }: {
    title?: string;
    contentMd?: string;
    class?: string;
    children?: import('svelte').Snippet;
  } = $props();

  const sanitizedContent = $derived(contentMd ? DOMPurify.sanitize(contentMd) : '');

  let container: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (container && sanitizedContent) {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
        ],
        throwOnError: false,
      });
    }
  });
</script>

<div class="flex h-full flex-col overflow-hidden {className}">
  {#if title}
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-semibold">{title}</h2>
    </div>
  {/if}
  <div class="flex-1 overflow-y-auto px-4 py-3">
    {#if contentMd}
      <div bind:this={container} class="prose prose-sm max-w-none dark:prose-invert">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html sanitizedContent}
      </div>
    {:else if children}
      {@render children()}
    {:else}
      <p class="text-sm text-muted-foreground">No description provided.</p>
    {/if}
  </div>
</div>

<style>
  :global(.prose pre) {
    color: var(--foreground) !important;
  }
  :global(.prose pre code) {
    color: inherit !important;
  }
  :global(.prose :not(pre) > code) {
    color: var(--foreground) !important;
  }
</style>

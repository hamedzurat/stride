<script lang="ts">
  let {
    class: className = '',
    children,
    wide = false,
  }: {
    class?: string;
    children: import('svelte').Snippet;
    wide?: boolean;
  } = $props();
</script>

<div
  class="{wide
    ? 'flex flex-col gap-6 p-4 md:p-6'
    : 'container mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-6'} {className}"
>
  {@render children()}
</div>

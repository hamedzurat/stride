<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';

  import { cn } from '$lib/utils.js';

  let { ref = $bindable(null), class: className, ...restProps }: TabsPrimitive.ContentProps = $props();
</script>

<TabsPrimitive.Content
  bind:ref
  data-slot="tabs-content"
  class={cn('flex-1 text-xs/relaxed outline-none', className)}
  {...restProps}
/>

<style>
  :global([data-slot='tabs-content'][data-state='active']) {
    animation: tabs-content-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes tabs-content-in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>

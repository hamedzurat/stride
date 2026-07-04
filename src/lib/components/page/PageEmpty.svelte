<script lang="ts">
  import { Button } from '$lib/components/ui/button/index.js';

  let {
    icon: Icon,
    title,
    description,
    action,
  }: {
    icon?: any;
    title: string;
    description: string;
    action?: { label: string; onclick: () => void };
  } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-24 text-center">
  {#if Icon}
    <Icon class="h-10 w-10 text-muted-foreground opacity-30" />
  {/if}
  <h3 class="text-lg font-bold tracking-tight">{title}</h3>
  <p class="text-sm text-muted-foreground">{description}</p>
  {#if action}
    <Button size="sm" onclick={action.onclick} class="mt-2 cursor-pointer gap-1.5 font-bold shadow-sm">
      {action.label}
    </Button>
  {/if}
</div>

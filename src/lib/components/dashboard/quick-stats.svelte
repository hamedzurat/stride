<script lang="ts">
  import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import CodeIcon from '@lucide/svelte/icons/code';
  import LayersIcon from '@lucide/svelte/icons/layers';

  import * as Card from '$lib/components/ui/card/index.js';
  import type { QuickStat } from '$lib/types/dashboard';

  let { stats }: { stats: QuickStat[] } = $props();

  const iconMap: Record<string, any> = {
    Layers: LayersIcon,
    Code: CodeIcon,
    CheckCircle: CheckCircleIcon,
    Clock: ClockIcon,
  };
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {#each stats as stat (stat.label)}
    {@const Icon = iconMap[stat.icon]}
    <Card.Root class="transition-all hover:shadow-md">
      <Card.Content class="flex items-center gap-4 p-6">
        <div class="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {#if Icon}
            <Icon class="size-6" />
          {/if}
        </div>
        <div class="flex flex-col gap-0.5">
          <p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">{stat.label}</p>
          <p class="text-2xl font-bold">{stat.value}</p>
        </div>
      </Card.Content>
    </Card.Root>
  {/each}
</div>

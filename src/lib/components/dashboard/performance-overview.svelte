<script lang="ts">
  import BookOpen from '@lucide/svelte/icons/book-open';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import TrendingUp from '@lucide/svelte/icons/trending-up';
  import Users from '@lucide/svelte/icons/users';

  import * as Card from '$lib/components/ui/card/index.js';
  import { Progress } from '$lib/components/ui/progress/index.js';
  import type { SectionPerformance } from '$lib/types/dashboard';

  let { performance }: { performance: SectionPerformance[] } = $props();
</script>

<div class="grid gap-6 md:grid-cols-3">
  {#each performance as section (section.sectionId)}
    <Card.Root class="overflow-hidden transition-all hover:shadow-lg">
      <Card.Header class="pb-2">
        <Card.Title class="text-sm font-bold tracking-tight text-muted-foreground uppercase">
          {section.sectionName}
        </Card.Title>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex items-end justify-between">
          <div class="flex flex-col gap-1">
            <p class="text-3xl font-black tracking-tighter">{section.averageScore}%</p>
            <p class="text-[10px] font-bold text-muted-foreground uppercase">Avg. Score</p>
          </div>
          <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp class="size-5" />
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-[10px] font-bold uppercase">
            <span class="text-muted-foreground">Pass Rate</span>
            <span class="text-primary">{section.passRate}%</span>
          </div>
          <Progress value={section.passRate} class="h-1.5" />
        </div>

        <div class="grid grid-cols-2 gap-4 border-t pt-4">
          <div class="flex items-center gap-2">
            <Users class="size-3 text-muted-foreground" />
            <span class="text-xs font-bold">{section.totalStudents} Students</span>
          </div>
          <div class="flex items-center gap-2">
            <BookOpen class="size-3 text-muted-foreground" />
            <span class="text-xs font-bold">{section.activeActivities} Activities</span>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/each}
</div>

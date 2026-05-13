<script lang="ts">
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ClockIcon from '@lucide/svelte/icons/clock';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { UpcomingActivity } from '$lib/types/dashboard';

  let { activities }: { activities: UpcomingActivity[] } = $props();

  function formatDate(date: number | string) {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTime(date: number | string) {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg">
      <CalendarIcon class="size-5 text-primary" />
      Upcoming Activities
    </Card.Title>
  </Card.Header>
  <Card.Content class="grid gap-4">
    {#each activities as activity (activity._id)}
      <div class="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
        <div class="flex flex-col gap-1">
          <h3 class="font-semibold">{activity.title}</h3>
          <p class="text-xs text-muted-foreground">{activity.sectionName}</p>
          <div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span class="flex items-center gap-1">
              <CalendarIcon class="size-3" />
              {formatDate(activity.startTime)}
            </span>
            <span class="flex items-center gap-1">
              <ClockIcon class="size-3" />
              {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
            </span>
          </div>
        </div>
        <div class="flex flex-col items-end gap-2">
          <Badge variant={activity.type === 'exam' ? 'destructive' : 'secondary'} class="capitalize">
            {activity.type}
          </Badge>
        </div>
      </div>
    {/each}
  </Card.Content>
</Card.Root>

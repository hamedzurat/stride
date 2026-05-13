<script lang="ts">
  import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Clock from '@lucide/svelte/icons/clock';
  import Plus from '@lucide/svelte/icons/plus';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { UpcomingActivity } from '$lib/types/dashboard';

  import ScheduleExamSheet from './schedule-exam-sheet.svelte';

  let { activities }: { activities: UpcomingActivity[] } = $props();

  let value = $state(today(getLocalTimeZone()));
  let isScheduleOpen = $state(false);

  const activityDates = $derived(
    activities.map((a) => {
      const d = new Date(a.startTime);
      return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }),
  );

  function getActivitiesForDate(date: any) {
    return activities.filter((a) => {
      const d = new Date(a.startTime);
      const ad = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return ad.compare(date) === 0;
    });
  }

  const selectedActivities = $derived(getActivitiesForDate(value));
</script>

<Card.Root>
  <Card.Header class="flex flex-row items-center justify-between pb-4">
    <Card.Title class="flex items-center gap-2 text-lg font-bold">
      <CalendarIcon class="size-5 text-primary" />
      Schedule & Conflicts
    </Card.Title>
    <button
      onclick={() => (isScheduleOpen = true)}
      class="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all hover:scale-105 hover:shadow-lg active:scale-95"
    >
      <Plus class="size-4" />
      Schedule Assessment
    </button>
  </Card.Header>

  <ScheduleExamSheet bind:open={isScheduleOpen} />
  <Card.Content class="grid items-start gap-10 p-8 lg:grid-cols-[auto_1fr]">
    <!-- Calendar -->
    <div class="flex flex-col gap-4">
      <Calendar
        type="single"
        bind:value
        class="rounded-2xl border bg-card p-6 shadow-sm [--cell-radius:0.75rem] [--cell-size:3rem]"
      >
        {#snippet day({ day, outsideMonth })}
          <div
            class="group/day relative flex h-full w-full cursor-pointer items-center justify-center rounded-xl transition-all hover:bg-primary/10"
          >
            <span
              class={outsideMonth
                ? 'text-muted-foreground/10'
                : 'text-lg font-bold transition-colors group-hover/day:text-primary'}
            >
              {day.day}
            </span>
            {#if activityDates.some((ad) => ad.compare(day) === 0)}
              <div class="absolute bottom-1.5 flex gap-1">
                <div class="size-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></div>
              </div>
            {/if}
          </div>
        {/snippet}
      </Calendar>

      <div
        class="flex items-center gap-2 rounded-xl border bg-orange-50/50 p-4 text-[10px] font-medium text-orange-700"
      >
        <AlertTriangle class="size-4 shrink-0" />
        Orange dots indicate existing activities across your sections.
      </div>
    </div>

    <!-- Timeline/Details -->
    <div class="flex h-full min-h-[400px] flex-col gap-6">
      <div class="flex items-center justify-between border-b border-muted pb-3">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">Occupancy Details</h3>
          <p class="text-xs font-medium text-primary">
            {value.day}
            {value.toDate(getLocalTimeZone()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Badge variant="outline" class="text-[10px] font-bold">
          {selectedActivities.length}
          {selectedActivities.length === 1 ? 'Booking' : 'Bookings'}
        </Badge>
      </div>

      <div class="space-y-4">
        {#if selectedActivities.length > 0}
          {#each selectedActivities as activity (activity._id)}
            <div class="flex flex-col gap-2 rounded-2xl border bg-muted/5 p-4 transition-all hover:bg-muted/10">
              <div class="flex items-center justify-between">
                <Badge
                  variant={activity.type === 'exam' ? 'destructive' : 'secondary'}
                  class="text-[9px] font-bold uppercase"
                >
                  {activity.type}
                </Badge>
                <div class="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                  <Clock class="size-3" />
                  {new Date(activity.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <h4 class="text-sm font-bold">{activity.title}</h4>
              <p class="text-[10px] font-medium text-muted-foreground uppercase">{activity.sectionName}</p>
            </div>
          {/each}
        {:else}
          <div
            class="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted/50 py-12 text-center text-muted-foreground"
          >
            <CheckCircle2 class="mb-3 size-10 opacity-10" />
            <p class="text-xs font-bold tracking-tight uppercase">Time Slot Clear</p>
            <p class="mt-1 text-[10px] opacity-60">No conflicting activities scheduled for this date.</p>
          </div>
        {/if}
      </div>
    </div>
  </Card.Content>
</Card.Root>

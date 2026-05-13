<script lang="ts">
  import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import ClockIcon from '@lucide/svelte/icons/clock';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Calendar } from '$lib/components/ui/calendar/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { UpcomingActivity } from '$lib/types/dashboard';

  let { activities }: { activities: UpcomingActivity[] } = $props();

  let value = $state(today(getLocalTimeZone()));

  // Map activities to dates for easy lookup
  const activityDates = $derived(
    activities.map((a) => {
      const d = new Date(a.startTime);
      return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }),
  );

  function hasActivity(date: any) {
    return activityDates.some((ad) => ad.compare(date) === 0);
  }

  function getActivitiesForDate(date: any) {
    return activities.filter((a) => {
      const d = new Date(a.startTime);
      const ad = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
      return ad.compare(date) === 0;
    });
  }

  const selectedActivities = $derived(getActivitiesForDate(value));
  let activeActivityId = $state<string | null>(null);

  // Auto-select the first activity when date changes or list updates
  $effect(() => {
    console.log('Selected date:', value.toString(), 'Activities found:', selectedActivities.length);
    if (selectedActivities.length > 0) {
      if (!activeActivityId || !selectedActivities.find((a) => a._id === activeActivityId)) {
        activeActivityId = selectedActivities[0]._id;
      }
    } else {
      activeActivityId = null;
    }
  });

  const activeActivity = $derived(selectedActivities.find((a) => a._id === activeActivityId) || null);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg font-bold">
      <CalendarIcon class="size-5 text-primary" />
      Activity Tracker
    </Card.Title>
  </Card.Header>
  <Card.Content class="grid items-start gap-10 p-8 lg:grid-cols-[auto_1fr]">
    <!-- Left Side: Calendar -->
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
            {#if hasActivity(day)}
              <div class="absolute bottom-1.5 flex gap-1">
                <div class="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)]"></div>
              </div>
            {/if}
          </div>
        {/snippet}
      </Calendar>

      {#if selectedActivities.length > 1}
        <div class="flex flex-col gap-2">
          <p class="px-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Other Events</p>
          <div class="flex flex-wrap gap-2">
            {#each selectedActivities as activity (activity._id)}
              <button
                onclick={() => (activeActivityId = activity._id)}
                class="rounded-full border px-3 py-1 text-[10px] font-bold transition-all {activeActivityId ===
                activity._id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:border-primary/50'}"
              >
                {activity.title}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Right Side: Detailed Activity View -->
    <div class="flex h-full min-h-[400px] flex-col gap-6">
      <div class="flex items-center justify-between border-b border-muted pb-3">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-bold tracking-wider text-muted-foreground uppercase">Daily Schedule</h3>
          <p class="text-xs font-medium text-primary">
            {value.day}
            {value.toDate(getLocalTimeZone()).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Badge variant="outline" class="text-[10px] font-bold">
          {selectedActivities.length}
          {selectedActivities.length === 1 ? 'Event' : 'Events'}
        </Badge>
      </div>

      <div class="flex-1">
        {#if activeActivity}
          {@const startTime = new Date(activeActivity.startTime)}
          {@const endTime = new Date(activeActivity.endTime)}
          {@const durationHours =
            Math.round(((activeActivity.endTime - activeActivity.startTime) / (1000 * 60 * 60)) * 10) / 10}

          <div class="flex animate-in flex-col gap-6 duration-300 fade-in slide-in-from-right-4">
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <Badge
                  variant={activeActivity.type === 'exam'
                    ? 'destructive'
                    : activeActivity.type === 'assignment'
                      ? 'outline'
                      : 'secondary'}
                  class="h-6 px-3 text-[10px] font-bold tracking-wider uppercase"
                >
                  {activeActivity.type}
                </Badge>
                <span class="text-xs font-bold text-primary/70">{activeActivity.sectionName}</span>
              </div>
              <h2 class="text-2xl leading-tight font-black tracking-tight">
                {activeActivity.title}
              </h2>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center gap-3 rounded-2xl border bg-muted/20 p-4">
                <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ClockIcon class="size-5" />
                </div>
                <div class="flex flex-col">
                  <p class="text-[10px] font-bold text-muted-foreground uppercase">Time</p>
                  <p class="text-xs font-bold">
                    {startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {endTime.toLocaleTimeString(
                      undefined,
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3 rounded-2xl border bg-muted/20 p-4">
                <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarIcon class="size-5" />
                </div>
                <div class="flex flex-col">
                  <p class="text-[10px] font-bold text-muted-foreground uppercase">Duration</p>
                  <p class="text-xs font-bold">{durationHours} Hours</p>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <p class="px-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Description</p>
              <div class="rounded-2xl border bg-muted/5 p-5 text-sm leading-relaxed text-muted-foreground">
                This is a detailed view of the {activeActivity.type} for {activeActivity.sectionName}. Please ensure you
                have all necessary materials ready before the {startTime.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })} start time.
              </div>
            </div>
          </div>
        {:else}
          <div
            class="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted/50 py-12 text-center text-muted-foreground"
          >
            <CalendarIcon class="mb-3 size-10 opacity-10" />
            <p class="text-xs font-bold tracking-tight uppercase">No Events Scheduled</p>
            <p class="mt-1 text-[10px] opacity-60">Select a date with a marker to view activities</p>
          </div>
        {/if}
      </div>
    </div>
  </Card.Content>
</Card.Root>

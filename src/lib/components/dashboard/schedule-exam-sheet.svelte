<script lang="ts">
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import Clock from '@lucide/svelte/icons/clock';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import * as Sheet from '$lib/components/ui/sheet/index.js';

  let { open = $bindable(false) } = $props();

  const sections = [
    { value: 'cse1111', label: 'CSE 1111: SPL' },
    { value: 'cse1115', label: 'CSE 1115: OOP' },
    { value: 'cse2215', label: 'CSE 2215: DSA I' },
  ];

  let selectedSection = $state('cse1111');
  let selectedType = $state('exam');
  let examTitle = $state('');
  let examDate = $state('');
  let startTime = $state('09:00');
  let endTime = $state('11:00');

  let selectedProblems = $state([
    { id: '1', title: 'Sum of Two Integers', difficulty: 'Easy' },
    { id: '2', title: 'Palindrome Checker', difficulty: 'Medium' },
  ]);

  function removeProblem(id: string) {
    selectedProblems = selectedProblems.filter((p) => p.id !== id);
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content side="right" class="w-full sm:max-w-2xl">
    <Sheet.Header>
      <Sheet.Title class="text-2xl font-black tracking-tight">Schedule Assessment</Sheet.Title>
      <Sheet.Description>Fill in the details below to create a new activity.</Sheet.Description>
    </Sheet.Header>

    <div class="mt-8 h-[calc(100vh-200px)] space-y-8 overflow-x-hidden overflow-y-auto px-1 pb-20">
      <!-- Basic Info -->
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase">Type</Label>
            <div class="flex gap-2">
              <button
                onclick={() => (selectedType = 'exam')}
                class="flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all {selectedType === 'exam'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'}"
              >
                Exam
              </button>
              <button
                onclick={() => (selectedType = 'assignment')}
                class="flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all {selectedType === 'assignment'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'}"
              >
                Assignment
              </button>
            </div>
          </div>
          <div class="grid gap-2">
            <Label class="text-[10px] font-bold text-muted-foreground uppercase">Target Section</Label>
            <Select.Root type="single" bind:value={selectedSection}>
              <Select.Trigger class="rounded-xl border-2 font-medium">
                {sections.find((s) => s.value === selectedSection)?.label}
              </Select.Trigger>
              <Select.Content>
                {#each sections as section}
                  <Select.Item value={section.value}>{section.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="grid gap-2">
          <Label for="title" class="text-[10px] font-bold text-muted-foreground uppercase">Assessment Title</Label>
          <Input
            id="title"
            placeholder="e.g. Midterm Assessment"
            bind:value={examTitle}
            class="rounded-xl border-2 font-medium focus-visible:ring-primary"
          />
        </div>
      </div>

      <!-- Schedule -->
      <div class="grid gap-6">
        <div class="grid gap-2">
          <Label for="date" class="text-[10px] font-bold text-muted-foreground uppercase">Date</Label>
          <div class="relative w-full">
            <CalendarIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="date" type="date" bind:value={examDate} class="w-full rounded-xl border-2 pl-10 font-medium" />
          </div>
        </div>
        <div class="grid gap-2">
          <Label for="duration" class="text-[10px] font-bold text-muted-foreground uppercase">Time Range</Label>
          <div class="flex items-center gap-4">
            <div class="relative flex-1">
              <Clock class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="time" bind:value={startTime} class="w-full rounded-xl border-2 pl-10 font-medium" />
            </div>
            <span class="text-xs font-bold text-muted-foreground uppercase">to</span>
            <div class="relative flex-1">
              <Clock class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="time" bind:value={endTime} class="w-full rounded-xl border-2 pl-10 font-medium" />
            </div>
          </div>
        </div>
      </div>

      <!-- Problems Selection -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <Label class="text-[10px] font-bold text-muted-foreground uppercase">Selected Problems</Label>
          <Button variant="ghost" size="sm" class="h-6 text-[10px] font-bold text-primary uppercase">
            <Plus class="mr-1 size-3" /> Add Problem
          </Button>
        </div>

        <div class="space-y-2">
          {#each selectedProblems as problem (problem.id)}
            <div
              class="flex items-center justify-between rounded-xl border bg-muted/20 p-3 transition-all hover:bg-muted/30"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex size-8 items-center justify-center rounded-lg bg-background font-bold text-primary shadow-sm"
                >
                  {problem.id}
                </div>
                <div>
                  <p class="text-sm font-bold">{problem.title}</p>
                  <Badge variant="secondary" class="h-4 px-1.5 text-[8px] font-bold uppercase"
                    >{problem.difficulty}</Badge
                  >
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 text-destructive hover:bg-destructive/10"
                onclick={() => removeProblem(problem.id)}
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          {/each}

          {#if selectedProblems.length === 0}
            <div
              class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground"
            >
              <Search class="mb-2 size-6 opacity-20" />
              <p class="text-xs font-medium">No problems selected yet.</p>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <Sheet.Footer class="absolute right-0 bottom-0 left-0 border-t bg-background p-6">
      <div class="flex w-full gap-3">
        <Button variant="outline" class="flex-1 rounded-full font-bold" onclick={() => (open = false)}>Cancel</Button>
        <Button
          class="flex-1 rounded-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105"
          onclick={() => (open = false)}
        >
          Confirm Assessment
        </Button>
      </div>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>

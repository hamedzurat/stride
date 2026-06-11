<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import FastForwardIcon from '@lucide/svelte/icons/fast-forward';
  import PauseIcon from '@lucide/svelte/icons/pause';
  import PlayIcon from '@lucide/svelte/icons/play';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SkipBackIcon from '@lucide/svelte/icons/skip-back';
  import SkipForwardIcon from '@lucide/svelte/icons/skip-forward';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import XIcon from '@lucide/svelte/icons/x';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { mode } from 'mode-watcher';
  import { createHighlighter, type HighlighterCore } from 'shiki';
  import { ShikiMagicMove } from 'shiki-magic-move/svelte';

  import SubmissionResultView from '$lib/components/submission-result-view.svelte';
  import { getShikiLang } from '$lib/judge0-utils';

  import 'shiki-magic-move/dist/style.css';

  import { Slider as SliderPrimitive } from 'bits-ui';
  import { diffLines } from 'diff';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import LanguageSelect from '$lib/components/language-select.svelte';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import type { SubmissionResult } from '$lib/server/judge0';

  // ─── Route params ──────────────────────────────────────────────────────────
  const activityId = $derived(page.params.activityId as Id<'activities'>);
  const problemId = $derived(page.params.problemId as Id<'problems'>);
  const studentId = $derived(page.params.studentId as Id<'users'>);

  // ─── Convex queries ────────────────────────────────────────────────────────
  const client = useConvexClient();

  const activityQuery = useQuery(api.activities.get, () => ({ id: activityId }));
  const problemQuery = useQuery(api.problems.get, () => ({ id: problemId }));
  const studentQuery = useQuery(api.users.get, () => ({ id: studentId }));
  const snapshotsQuery = useQuery(api.snapshots.listByAuthor, () => ({
    authorId: studentId,
    activityId,
    problemId,
  }));
  const submissionsQuery = useQuery(api.submissions.listByAuthor, () => ({
    authorId: studentId,
    activityId,
    problemId,
  }));
  const studentsQuery = useQuery(api.sections.listStudents, () =>
    activityQuery.data ? { sectionId: activityQuery.data.sectionId } : 'skip',
  );
  const testCasesQuery = useQuery(api.problems.listIO, () => ({ problemId }));

  // ─── Derived data ──────────────────────────────────────────────────────────
  const activity = $derived(activityQuery.data);
  const problem = $derived(problemQuery.data);
  const student = $derived(studentQuery.data);
  const snapshots = $derived(snapshotsQuery.data ?? []);
  const totalSnapshots = $derived(snapshots.length);
  const submissions = $derived(submissionsQuery.data ?? []);
  const lastSubmittedCode = $derived(submissions[0]?.content ?? '');
  const students = $derived(
    (studentsQuery.data ?? [])
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const testCases = $derived(testCasesQuery.data ?? []);

  // ─── Change magnitude heatmap ──────────────────────────────────────────────
  function computeChangeMagnitudes(snaps: { content: string }[]): number[] {
    if (snaps.length < 2) return [];
    const magnitudes: number[] = [];
    for (let i = 0; i < snaps.length - 1; i++) {
      const changes = diffLines(snaps[i].content, snaps[i + 1].content);
      let total = 0;
      for (const c of changes) {
        if (c.added || c.removed) total += c.count;
      }
      magnitudes.push(total);
    }
    return magnitudes;
  }

  const changeMagnitudes = $derived(computeChangeMagnitudes(snapshots));
  const maxMagnitude = $derived(Math.max(...changeMagnitudes, 1));
  const normalizedMagnitudes = $derived(changeMagnitudes.map((m) => m / maxMagnitude));

  // Student navigation
  const currentStudentIndex = $derived(students.findIndex((s) => s._id === studentId));
  const prevStudent = $derived(currentStudentIndex > 0 ? students[currentStudentIndex - 1] : null);
  const nextStudent = $derived(
    currentStudentIndex >= 0 && currentStudentIndex < students.length - 1 ? students[currentStudentIndex + 1] : null,
  );

  // ─── Shiki highlighter ────────────────────────────────────────────────────
  let highlighter = $state<HighlighterCore | null>(null);
  const shikiTheme = $derived(mode.current === 'light' ? 'github-light' : 'github-dark');

  onMount(async () => {
    const savedSpeed = localStorage.getItem('stride:playback-speed');
    if (savedSpeed) {
      speedStr = savedSpeed;
    }

    highlighter = await createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['python', 'javascript', 'typescript', 'java', 'c', 'cpp'],
    });
  });

  // ─── Playback state ───────────────────────────────────────────────────────
  let currentIndex = $state(0);
  let isPlaying = $state(false);
  let speed = $state(1);
  let speedStr = $state('1');

  const currentCode = $derived(snapshots[currentIndex]?.content ?? '');
  const lastCode = $derived(lastSubmittedCode || (snapshots[totalSnapshots - 1]?.content ?? ''));
  const isPausedNotAtEnd = $derived(!isPlaying && currentIndex < totalSnapshots - 1);
  const codeToRun = $derived(isPausedNotAtEnd ? currentCode : lastCode);
  const runButtonText = $derived(
    isPausedNotAtEnd
      ? `Run Current Snapshot (${testCases.length})`
      : `Run ${lastSubmittedCode ? 'Submitted' : 'Last Snapshot'} (${testCases.length})`,
  );

  const currentTimestamp = $derived(snapshots[currentIndex]?.timestamp ?? null);
  const canStepBack = $derived(currentIndex > 0);
  const canStepForward = $derived(currentIndex < totalSnapshots - 1);

  const magicMoveOptions = $derived({
    duration: Math.min(400, (1500 / speed) * 0.8),
    stagger: 3,
    animateContainer: true,
  });

  // Sync speed from select string
  $effect(() => {
    speed = parseInt(speedStr, 10);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('stride:playback-speed', speedStr);
    }
  });

  // Reset playback on student change
  $effect(() => {
    void studentId;
    currentIndex = 0;
    isPlaying = true;
  });

  let hasRunInitialTests = $state(false);

  // Reset auto-run flag on student change
  $effect(() => {
    void studentId;
    hasRunInitialTests = false;
  });

  // ─── Test case management ─────────────────────────────────────────────────
  let selectedLanguageId = $derived(getBestSubmission(studentId, problemId)?.languageId?.toString() ?? undefined);
  let isExecuting = $state(false);
  const results = new SvelteMap<string, SubmissionResult>();

  // Auto-run tests with submitted code when available, fall back to last snapshot
  $effect(() => {
    const code = lastSubmittedCode || snapshots[totalSnapshots - 1]?.content || '';
    if (code && testCases.length > 0 && selectedLanguageId && !hasRunInitialTests && !isExecuting) {
      hasRunInitialTests = true;
      runAllTestCases(code);
    }
  });

  // Auto-play interval
  $effect(() => {
    if (!isPlaying || totalSnapshots <= 1) return;

    const interval = 1500 / speed;
    const id = setInterval(() => {
      if (currentIndex < totalSnapshots - 1) {
        currentIndex++;
      } else {
        currentIndex = 0;
      }
    }, interval);

    return () => clearInterval(id);
  });

  function heatmapColor(t: number): string {
    const e = Math.pow(t, 2.5);
    const alpha = 0.15 + e * 0.85; // floor 0.15, max 1.0
    return `hsla(${Math.round(25 - e * 25)}, 85%, ${Math.round(55 - e * 20)}%, ${alpha.toFixed(3)})`;
  }

  function heatmapGradient(mags: number[]): string {
    const step = 100 / mags.length;
    const stops = mags.map((mag, i) => {
      const start = Math.round(i * step * 10) / 10;
      const end = Math.round((i + 1) * step * 10) / 10;
      return `${heatmapColor(mag)} ${start}% ${end}%`;
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function togglePlay() {
    if (currentIndex >= totalSnapshots - 1) {
      currentIndex = 0;
    }
    isPlaying = !isPlaying;
  }

  // ─── Language mapping (Judge0 ID → shiki lang) ────────────────────────────
  const shikiLang = $derived(getShikiLang(selectedLanguageId));

  // Auto-detect language from student's snapshots (they save their chosen languageId)
  const snapshotLanguageId = $derived(getBestSubmission(studentId, problemId)?.languageId?.toString() ?? undefined);

  // Set language from snapshot if teacher hasn't manually changed it
  let languageAutoSet = $state(false);
  $effect(() => {
    if (snapshotLanguageId && !languageAutoSet) {
      selectedLanguageId = snapshotLanguageId;
      languageAutoSet = true;
    }
  });

  // Reset auto-set flag when student changes
  $effect(() => {
    void studentId;
    languageAutoSet = false;
  });

  // ─── Verdict helper ───────────────────────────────────────────────────────

  // Helper to find best submission per student per problem
  function getBestSubmission(studentId: Id<'users'>, problemId: Id<'problems'>) {
    const studentSubs = submissions.filter((s) => s.authorId === studentId && s.problemId === problemId);
    if (studentSubs.length === 0) return null;
    const accepted = studentSubs.find((s) => s.judgeVerdict === 'Accepted');
    if (accepted) return accepted;
    return studentSubs.sort((a, b) => b.submittedAt - a.submittedAt)[0];
  }

  function getVerdict(
    tc: { outputData: string },
    result: SubmissionResult | undefined,
  ): 'pass' | 'fail' | 'error' | null {
    if (!result) return null;
    if (result.status?.id !== 3) return 'error';
    if (!tc.outputData) return null;
    return result.stdout?.trim() === tc.outputData.trim() ? 'pass' : 'fail';
  }

  async function addTestCase() {
    const nextOrder = testCases.length;
    await client.mutation(api.problems.addIO, {
      problemId,
      inputData: '',
      outputData: '',
      ioOrder: nextOrder,
    });
  }

  async function removeTestCase(id: Id<'problemIos'>) {
    if (!confirm('Are you sure you want to delete this test case? This action cannot be undone.')) return;
    await client.mutation(api.problems.removeIO, { id });
    results.delete(id);
  }

  async function updateTestCaseInput(id: Id<'problemIos'>, inputData: string) {
    await client.mutation(api.problems.updateIO, { id, inputData });
  }

  async function updateTestCaseOutput(id: Id<'problemIos'>, outputData: string) {
    await client.mutation(api.problems.updateIO, { id, outputData });
  }

  async function runAllTestCases(overrideCode?: string) {
    if (!selectedLanguageId || testCases.length === 0) return;

    const code = overrideCode ?? codeToRun;
    if (!code) return;

    isExecuting = true;
    results.clear();

    try {
      const submissions = testCases.map((tc) => ({
        source_code: code,
        language_id: parseInt(selectedLanguageId!, 10),
        stdin: tc.inputData || undefined,
      }));

      const res = await fetch('/api/judge0/submissions/batch?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissions }),
      });

      if (!res.ok) throw new Error('Batch submission failed');

      const data: { submissions: SubmissionResult[] } = await res.json();

      results.clear();
      testCases.forEach((tc, i) => {
        if (data.submissions[i]) {
          results.set(tc._id, data.submissions[i]);
        }
      });
    } finally {
      isExecuting = false;
    }
  }
</script>

<div class="flex h-full w-full flex-1">
  <Resizable.PaneGroup direction="horizontal" class="h-full w-full rounded-lg border">
    <!-- ═══ LEFT PANE: Code Viewer + Controls + Student Bar ═══ -->
    <Resizable.Pane defaultSize={65} minSize={35}>
      <div class="flex h-full flex-col">
        <!-- Problem Header -->
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-semibold">
              {#if problem}
                {problem.title}
              {:else}
                <Skeleton class="h-4 w-32" />
              {/if}
            </h1>
          </div>
          {#if activity}
            <span class="text-xs text-muted-foreground">{activity.title}</span>
          {/if}
        </div>

        <!-- Code Viewer -->
        <div class="relative flex-1 overflow-auto bg-muted/20 p-4">
          {#if highlighter && totalSnapshots > 0}
            <div class="h-full overflow-auto rounded-md font-mono text-sm">
              <ShikiMagicMove
                {highlighter}
                lang={shikiLang}
                theme={shikiTheme}
                code={currentCode}
                options={magicMoveOptions}
                class="min-h-full p-4"
              />
            </div>
          {:else if snapshotsQuery.isLoading || !highlighter}
            <div class="flex h-full flex-col gap-2 p-4">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-4 w-5/6" />
              <Skeleton class="h-4 w-2/3" />
              <Skeleton class="h-4 w-3/5" />
              <Skeleton class="h-4 w-1/3" />
            </div>
          {:else}
            <div class="flex h-full items-center justify-center text-muted-foreground">
              No snapshots recorded for this student
            </div>
          {/if}
        </div>

        <Separator />

        <!-- Playback Controls -->
        <div class="flex items-center gap-3 px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={!canStepBack || totalSnapshots === 0}
            onclick={() => {
              currentIndex--;
              isPlaying = false;
            }}
            aria-label="Step back"
          >
            <SkipBackIcon class="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={totalSnapshots <= 1}
            onclick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {#if isPlaying}
              <PauseIcon class="size-4" />
            {:else}
              <PlayIcon class="size-4" />
            {/if}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={!canStepForward || totalSnapshots === 0}
            onclick={() => {
              currentIndex++;
              isPlaying = false;
            }}
            aria-label="Step forward"
          >
            <SkipForwardIcon class="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            disabled={!canStepForward || totalSnapshots === 0}
            onclick={() => {
              currentIndex = totalSnapshots - 1;
              isPlaying = false;
            }}
            title="Jump to last snapshot"
            aria-label="Jump to last snapshot"
          >
            <FastForwardIcon class="size-4" />
          </Button>

          <div class="mx-2 flex-1">
            <SliderPrimitive.Root
              data-slot="slider"
              type="single"
              value={currentIndex as never}
              max={Math.max(0, totalSnapshots - 1)}
              step={1}
              disabled={totalSnapshots === 0}
              onValueChange={(v: number) => {
                currentIndex = v;
                isPlaying = false;
              }}
              class="relative flex w-full touch-none items-center select-none data-disabled:opacity-50"
            >
              {#snippet children({ thumbItems })}
                <span
                  data-slot="slider-track"
                  data-orientation="horizontal"
                  class="relative h-1 w-full grow overflow-hidden rounded-md bg-muted"
                  style={totalSnapshots >= 2 ? `background: ${heatmapGradient(normalizedMagnitudes)}` : undefined}
                >
                  <SliderPrimitive.Range
                    data-slot="slider-range"
                    class="absolute h-full rounded-md bg-primary/15 select-none"
                  />
                </span>
                {#each thumbItems as thumb (thumb.index)}
                  <SliderPrimitive.Thumb
                    data-slot="slider-thumb"
                    index={thumb.index}
                    class="relative block size-3 shrink-0 rounded-md border border-ring bg-background ring-ring/30 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden active:ring-2 disabled:pointer-events-none disabled:opacity-50"
                  />
                {/each}
              {/snippet}
            </SliderPrimitive.Root>
          </div>

          <span class="min-w-[60px] text-center text-xs text-muted-foreground">
            {#if totalSnapshots > 0}
              {currentIndex + 1} / {totalSnapshots}
            {:else}
              0 / 0
            {/if}
          </span>

          {#if currentTimestamp}
            <span class="text-xs text-muted-foreground">
              {formatTimestamp(currentTimestamp)}
            </span>
          {/if}

          <Select.Root type="single" bind:value={speedStr}>
            <Select.Trigger class="h-8 w-[72px]">
              {speed}x
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="1" label="1x">1x</Select.Item>
              <Select.Item value="2" label="2x">2x</Select.Item>
              <Select.Item value="3" label="3x">3x</Select.Item>
              <Select.Item value="4" label="4x">4x</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <Separator />

        <!-- Student Info Bar -->
        <div class="flex items-center justify-between px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevStudent}
            onclick={() => prevStudent && goto(`/activities/${activityId}/playback/${problemId}/${prevStudent._id}`)}
          >
            <ChevronLeftIcon class="mr-1 size-4" />
            Previous
          </Button>

          <div class="flex items-center gap-3">
            {#if student}
              <Avatar.Root class="size-8">
                <Avatar.Image src={student.avatarUrl} alt={student.name} />
                <Avatar.Fallback class="text-xs">{student.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
              </Avatar.Root>
              <div class="flex flex-col">
                <span class="text-sm font-medium">{student.name}</span>
                <span class="text-xs text-muted-foreground">{student.email}</span>
              </div>
            {:else}
              <Skeleton class="size-8 rounded-full" />
              <div class="flex flex-col gap-1">
                <Skeleton class="h-4 w-24" />
                <Skeleton class="h-3 w-32" />
              </div>
            {/if}
            {#if students.length > 0}
              <Badge variant="secondary" class="ml-2 text-xs">
                {currentStudentIndex + 1} / {students.length}
              </Badge>
            {/if}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={!nextStudent}
            onclick={() => nextStudent && goto(`/activities/${activityId}/playback/${problemId}/${nextStudent._id}`)}
          >
            Next
            <ChevronRightIcon class="ml-1 size-4" />
          </Button>
        </div>
      </div>
    </Resizable.Pane>

    <Resizable.Handle />

    <!-- ═══ RIGHT PANE: Test Case Manager ═══ -->
    <Resizable.Pane defaultSize={35} minSize={25}>
      <div class="flex h-full flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 class="text-sm font-semibold">Test Cases</h2>
          <LanguageSelect bind:value={selectedLanguageId} disabled={isExecuting} />
        </div>

        <!-- Test Case List -->
        <div class="flex-1 overflow-auto">
          {#if testCases.length === 0}
            <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p class="text-sm text-muted-foreground">No test cases yet</p>
              <Button variant="outline" size="sm" onclick={addTestCase}>
                <PlusIcon class="mr-1 size-4" />
                Add your first test case
              </Button>
            </div>
          {:else}
            <div class="flex max-h-[calc(100dvh-120px)] flex-col gap-0">
              {#each testCases as tc, i (tc._id)}
                {@const result = results.get(tc._id)}
                {@const verdict = getVerdict(tc, result)}
                <div class="border-b p-3">
                  <!-- Test case header -->
                  <div class="mb-2 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-medium text-muted-foreground">Test #{i + 1}</span>
                      {#if verdict === 'pass'}
                        <Badge variant="success" class="text-xs">
                          <CheckIcon class="mr-1 size-3" />
                          Pass
                        </Badge>
                      {:else if verdict === 'fail'}
                        <Badge variant="destructive" class="text-xs">
                          <XIcon class="mr-1 size-3" />
                          Fail
                        </Badge>
                      {:else if verdict === 'error'}
                        <Badge variant="destructive" class="text-xs">
                          <CircleAlertIcon class="mr-1 size-3" />
                          Error
                        </Badge>
                      {/if}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-6 text-muted-foreground hover:text-destructive"
                      onclick={() => removeTestCase(tc._id)}
                      aria-label="Remove test case"
                    >
                      <Trash2Icon class="size-3.5" />
                    </Button>
                  </div>

                  <!-- Input field -->
                  <div class="mb-1.5">
                    <label for="input-{tc._id}" class="mb-0.5 block text-xs text-muted-foreground">Input (stdin)</label>
                    <Textarea
                      id="input-{tc._id}"
                      class="min-h-[48px] resize-none font-mono text-xs"
                      placeholder="Enter input..."
                      value={tc.inputData}
                      onblur={(e) => updateTestCaseInput(tc._id, e.currentTarget.value)}
                    />
                  </div>

                  <!-- Expected output field -->
                  <div class="mb-1.5">
                    <label for="output-{tc._id}" class="mb-0.5 block text-xs text-muted-foreground"
                      >Expected Output</label
                    >
                    <Textarea
                      id="output-{tc._id}"
                      class="min-h-[48px] resize-none font-mono text-xs"
                      placeholder="Enter expected output..."
                      value={tc.outputData}
                      onblur={(e) => updateTestCaseOutput(tc._id, e.currentTarget.value)}
                    />
                  </div>

                  <!-- Result display -->
                  {#if result}
                    <SubmissionResultView {result} showTabs={false} />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Footer: Add + Run All -->
        <div class="flex items-center gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" onclick={addTestCase}>
            <PlusIcon class="mr-1 size-4" />
            Add
          </Button>
          <Button
            size="sm"
            class="flex-1"
            disabled={isExecuting || !selectedLanguageId || testCases.length === 0 || !codeToRun}
            onclick={() => runAllTestCases()}
          >
            {#if isExecuting}
              <Spinner class="mr-2 size-4" />
              Running...
            {:else}
              <PlayIcon class="mr-1 size-4" />
              {runButtonText}
            {/if}
          </Button>
        </div>
      </div>
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>

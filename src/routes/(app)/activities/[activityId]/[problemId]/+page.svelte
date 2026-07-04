<script lang="ts">
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';
  import { env } from '$env/dynamic/public';

  import Codemirror from '$lib/components/editor/Codemirror.svelte';
  import LanguageSelect from '$lib/components/language-select.svelte';
  import ProblemContent from '$lib/components/problem-content.svelte';
  import SubmissionResultView from '$lib/components/submission-result-view.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { getLanguageName } from '$lib/judge0-utils';
  import type { SubmissionResult } from '$lib/server/judge0';
  import { session } from '$lib/session';

  const userRole = $derived($session?.role);

  const problemQuery = useQuery(api.problems.get, () =>
    page.params.problemId ? { id: page.params.problemId as Id<'problems'> } : 'skip',
  );
  const testCasesQuery = useQuery(api.problems.listIO, () =>
    page.params.problemId ? { problemId: page.params.problemId as Id<'problems'> } : 'skip',
  );
  const latestSnapshotArgs = $derived(
    $session?.userId && page.params.problemId && page.params.activityId
      ? {
          authorId: $session.userId as Id<'users'>,
          activityId: page.params.activityId as Id<'activities'>,
          problemId: page.params.problemId as Id<'problems'>,
        }
      : 'skip',
  );
  const latestSnapshotQuery = useQuery(api.snapshots.getLatest, () => latestSnapshotArgs);

  let sourceCode = $state('');
  let stdinData = $state('');
  let selectedLanguageId = $state<string | undefined>(undefined);
  let codemirrorLanguage = $derived(getLanguageName(selectedLanguageId));

  let isExecuting = $state(false);
  let isSubmitting = $state(false);
  let result = $state<SubmissionResult | null>(null);

  const testCases = $derived(testCasesQuery.data ?? []);

  $effect(() => {
    const snap = latestSnapshotQuery.data;
    if (snap?.content && sourceCode === '') {
      sourceCode = snap.content;
    }
  });

  async function executeCode() {
    if (!selectedLanguageId) return;

    isExecuting = true;
    result = null;

    try {
      const submitRes = await fetch('/api/judge0/submissions?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: sourceCode,
          language_id: parseInt(selectedLanguageId, 10),
          stdin: stdinData || undefined,
        }),
      });

      if (!submitRes.ok) throw new Error('Submission failed');

      result = await submitRes.json();
    } catch (_err) {
      toast.error('Failed to run code. Check the console or try again.');
    } finally {
      isExecuting = false;
    }
  }

  async function submitCode() {
    if (!selectedLanguageId || !sourceCode || !$session?.userId) return;

    isSubmitting = true;
    try {
      const id = await client.mutation(api.submissions.submit, {
        authorId: $session.userId,
        problemId: page.params.problemId as Id<'problems'>,
        activityId: page.params.activityId as Id<'activities'>,
        content: sourceCode,
        languageId: Number(selectedLanguageId),
      });

      if (testCases.length > 0) {
        const submissions = testCases.map((tc) => ({
          source_code: sourceCode,
          language_id: Number(selectedLanguageId),
          stdin: tc.inputData || undefined,
        }));

        const res = await fetch('/api/judge0/submissions/batch?wait=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissions }),
        });

        if (res.ok) {
          const data: { submissions: SubmissionResult[] } = await res.json();

          const allPassed = data.submissions.every((r, i) => {
            if (r.status?.id !== 3) return false;
            return r.stdout?.trim() === testCases[i].outputData.trim();
          });
          const anyError = data.submissions.some((r) => r.status?.id !== 3);

          let verdict: string;
          if (allPassed) {
            verdict = 'Accepted';
          } else if (anyError) {
            verdict = data.submissions.find((r) => r.status?.id !== 3)?.status?.description ?? 'Runtime Error';
          } else {
            verdict = 'Wrong Answer';
          }

          await client.mutation(api.submissions.setVerdict, { id, judgeVerdict: verdict });
        }
      }

      toast.success('Code submitted successfully');
    } catch (_err) {
      toast.error('Failed to submit code. Try again.');
    } finally {
      isSubmitting = false;
    }
  }

  let lastSourceCode = '';
  const client = useConvexClient();
  const SNAPSHOT_INTERVAL = env.PUBLIC_SNAPSHOT_INTERVAL ? parseInt(env.PUBLIC_SNAPSHOT_INTERVAL, 10) : 5000;
  function snapshotSave() {
    if (userRole === 'admin') return;
    if (!$session?.userId) return;
    if (!page.params.problemId || !page.params.activityId) return;
    if (sourceCode !== lastSourceCode) {
      client.mutation(api.snapshots.save, {
        authorId: $session.userId,
        problemId: page.params.problemId as Id<'problems'>,
        activityId: page.params.activityId as Id<'activities'>,
        content: sourceCode,
        languageId: Number(selectedLanguageId),
      });
      lastSourceCode = sourceCode;
    }
    setTimeout(snapshotSave, SNAPSHOT_INTERVAL);
  }
  onMount(snapshotSave);
</script>

<div class="flex h-full w-full flex-1">
  <Resizable.PaneGroup direction="horizontal" class="h-full w-full rounded-lg border">
    <Resizable.Pane defaultSize={50} minSize={20}>
      {#if problemQuery.isLoading}
        <div class="flex h-full flex-col gap-3 p-4">
          <div class="flex items-center gap-2">
            <Skeleton class="h-9 w-28 rounded-md" />
            <Skeleton class="h-9 w-20 rounded-md" />
          </div>
          <div class="flex-1 space-y-3">
            {#each [1, 2, 3, 4, 5, 6, 7, 8] as i (i)}
              <Skeleton class="h-4 w-full" />
            {/each}
          </div>
        </div>
      {:else}
        <Codemirror
          initialContent={sourceCode}
          language={codemirrorLanguage}
          onUpdate={(text: string) => (sourceCode = text)}
          editable={userRole !== 'admin'}
        />
      {/if}
    </Resizable.Pane>

    <Resizable.Handle />

    <Resizable.Pane defaultSize={50} minSize={20}>
      <Resizable.PaneGroup direction="vertical" class="h-full">
        <Resizable.Pane defaultSize={70} minSize={15}>
          {#if problemQuery.isLoading}
            <div class="flex h-full flex-col gap-4 p-6">
              <Skeleton class="h-6 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
              <div class="mt-4 space-y-2">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-5/6" />
                <Skeleton class="h-4 w-4/5" />
                <Skeleton class="h-4 w-3/4" />
              </div>
            </div>
          {:else if !problemQuery.data}
            <div class="mb-2 text-sm font-medium text-destructive">Error loading question</div>
          {:else}
            <ProblemContent title={problemQuery.data.title} contentMd={problemQuery.data.contentMd} />
          {/if}
        </Resizable.Pane>

        <Resizable.Handle />

        <Resizable.Pane defaultSize={30} minSize={15}>
          {#if userRole === 'admin'}
            <div class="flex h-full w-full flex-col items-center justify-center border-t bg-muted/10 p-6 text-center">
              <span class="text-xs font-semibold text-muted-foreground">Admin View Only Mode</span>
              <p class="mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground/75">
                You are viewing this activity's problem description in read-only mode. Code editing, sandbox execution,
                and snapshot saves are disabled.
              </p>
            </div>
          {:else}
            <Resizable.PaneGroup direction="horizontal" class="h-full w-full border-t">
              <Resizable.Pane defaultSize={50} minSize={20}>
                <div class="flex h-full flex-col gap-2 p-4">
                  <div class="flex items-center gap-2">
                    <LanguageSelect bind:value={selectedLanguageId} disabled={isExecuting} />
                    <Button size="sm" onclick={executeCode} disabled={isExecuting || !selectedLanguageId}>
                      {#if isExecuting}
                        <Spinner class="mr-2 h-4 w-4" />
                        Executing...
                      {:else}
                        Execute
                      {/if}
                    </Button>
                    <Button
                      size="sm"
                      onclick={submitCode}
                      disabled={isSubmitting || !sourceCode || !selectedLanguageId || !$session?.userId}
                    >
                      {#if isSubmitting}
                        <Spinner class="mr-2 h-4 w-4" />
                        Submitting...
                      {:else}
                        Submit
                      {/if}
                    </Button>
                  </div>
                  <Textarea
                    class="flex-1 resize-none font-mono text-sm"
                    placeholder="Standard Input (stdin)"
                    bind:value={stdinData}
                  />
                </div>
              </Resizable.Pane>

              <Resizable.Handle />

              <Resizable.Pane defaultSize={50} minSize={20}>
                <div class="flex h-full w-full flex-col overflow-hidden p-4">
                  {#if !result}
                    <div
                      class="flex h-full items-center justify-center rounded-md bg-muted/30 font-mono text-sm text-muted-foreground"
                    >
                      Run code to see output...
                    </div>
                  {:else}
                    <SubmissionResultView {result} showTabs={true} />
                  {/if}
                </div>
              </Resizable.Pane>
            </Resizable.PaneGroup>
          {/if}
        </Resizable.Pane>
      </Resizable.PaneGroup>
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>

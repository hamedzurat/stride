<script lang="ts">
  import { Experimental_StructuredObject } from '@ai-sdk/svelte';
  import Plus from '@lucide/svelte/icons/plus';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { useConvexClient } from 'convex-svelte';
  import { toast } from 'svelte-sonner';
  import { slide } from 'svelte/transition';
  import { z } from 'zod';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import Tiptap from '$lib/components/editor/Tiptap.svelte';
  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();

  // Form State
  let title = $state('');
  let contentMd = $state('');
  let isSubmitting = $state(false);
  let editorKey = $state(0);

  // Local Test Cases State
  let testCases = $state<{ inputData: string; outputData: string }[]>([]);

  // AI Streaming State
  const problemGenerator = new Experimental_StructuredObject({
    api: '/api/ai/generate-problem',
    schema: z.object({
      title: z.string(),
      contentMd: z.string(),
      testCases: z.array(
        z.object({
          inputData: z.string(),
          outputData: z.string(),
        }),
      ),
    }),
    onFinish: (result) => {
      if (result.object) {
        title = result.object.title || '';
        contentMd = result.object.contentMd || '';
        testCases = result.object.testCases || [];
        editorKey++;
        toast.success('AI Problem generated successfully!');
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Error communicating with AI generator.');
    },
  });

  let displayTitle = $derived(problemGenerator.loading ? (problemGenerator.object?.title ?? title) : title);
  let displayTestCases = $derived(
    problemGenerator.loading
      ? (problemGenerator.object?.testCases ?? []).map((tc) => ({
          inputData: tc?.inputData ?? '',
          outputData: tc?.outputData ?? '',
        }))
      : testCases,
  );
  let newCaseInput = $state('');
  let newCaseOutput = $state('');

  const isTeacherOrAdmin = $derived($session && ($session.role === 'teacher' || $session.role === 'admin'));

  function addLocalTestCase() {
    if (!newCaseOutput.trim()) {
      return toast.error('Expected output is required.');
    }
    testCases = [...testCases, { inputData: newCaseInput, outputData: newCaseOutput.trim() }];
    newCaseInput = '';
    newCaseOutput = '';
    toast.success('Test case added to suite.');
  }

  function removeLocalTestCase(index: number) {
    testCases = testCases.filter((_, i) => i !== index);
  }

  async function generateProblem() {
    const plainText = contentMd.replace(/<[^>]*>/g, '').trim();
    if (!plainText) {
      return toast.error('Please write a short prompt in the description first.');
    }

    problemGenerator.submit({ prompt: plainText, currentTitle: title });
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title.trim()) return toast.error('Problem title is required.');
    const plainText = contentMd.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return toast.error('Problem description is required.');
    if (!$session?.userId) return;

    isSubmitting = true;
    try {
      // 1. Create problem
      const problemId = await client.mutation(api.problems.create, {
        createdBy: $session.userId,
        title: title.trim(),
        contentMd: contentMd.trim(),
      });

      // 2. Add test cases
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        await client.mutation(api.problems.addIO, {
          problemId,
          inputData: tc.inputData,
          outputData: tc.outputData,
          ioOrder: i + 1,
        });
      }

      toast.success('Problem created successfully!', {
        description: `"${title.trim()}" has been added to your problem library.`,
      });
      goto(`/problems/${problemId}`);
    } catch (_err) {
      toast.error('Failed to create problem.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<PageLayout>
  {#if !isTeacherOrAdmin}
    <div
      class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-destructive/30 py-20 text-center"
    >
      <h3 class="text-xl font-bold text-destructive">Access Restricted</h3>
      <p class="text-sm text-muted-foreground">Only teachers and admins can create programming problems.</p>
    </div>
  {:else}
    <div class="flex flex-col gap-6">
      <!-- Title Card -->
      <PageHero
        title="New Problem"
        description="Create a new programming problem for students. Define the description and seed test cases to automatically validate submissions."
      />

      <!-- Problem Details Form -->
      <Card.Root class="border bg-card/45 shadow-sm backdrop-blur-md">
        <Card.Header class="flex flex-row items-center justify-between space-y-0 p-6">
          <div class="flex flex-col gap-1.5">
            <Card.Title class="text-lg font-bold tracking-tight">Problem Details</Card.Title>
            <Card.Description
              >Provide a concise title and clear details about the algorithmic challenge.</Card.Description
            >
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="gap-1.5"
            disabled={problemGenerator.loading}
            onclick={generateProblem}
          >
            {#if problemGenerator.loading}
              <Spinner class="size-4" />
            {:else}
              <Sparkles class="h-4 w-4" />
            {/if}
            Generate Problem
          </Button>
        </Card.Header>
        <Separator />
        <Card.Content class="p-6">
          <div class="flex flex-col gap-5">
            <!-- Title -->
            <div class="flex flex-col gap-2">
              <Label for="prob-title" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Problem Title</Label
              >
              <Input
                id="prob-title"
                placeholder="e.g. Reverse a Linked List..."
                value={displayTitle}
                oninput={(e: any) => (title = e.currentTarget.value)}
                maxlength={150}
                required
                disabled={problemGenerator.loading}
                class="border-primary/20 text-sm focus-visible:ring-primary/30"
              />
            </div>

            <!-- Description -->
            <div class="flex flex-col gap-2">
              <Label for="prob-desc" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                >Problem Description</Label
              >
              {#if problemGenerator.loading}
                <div
                  class="prose prose-sm min-h-[150px] w-full max-w-full cursor-not-allowed rounded-md border border-input bg-background px-3 py-2 text-sm opacity-50 shadow-sm dark:prose-invert"
                >
                  {@html problemGenerator.object?.contentMd || ''}
                </div>
              {:else}
                {#key editorKey}
                  <Tiptap initialContent={contentMd} onUpdate={(html: string) => (contentMd = html)} />
                {/key}
              {/if}
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Test Cases Suite Builder -->
      <Card.Root class="border bg-card/45 shadow-sm backdrop-blur-md">
        <Card.Header class="p-6">
          <Card.Title class="flex items-center gap-1.5 text-lg font-bold tracking-tight">Seed Test Cases</Card.Title>
          <Card.Description>Add the test cases that student submissions will be evaluated against.</Card.Description>
        </Card.Header>
        <Separator />

        <Card.Content class="flex flex-col gap-6 p-6">
          <!-- Locally added test cases list -->
          {#if displayTestCases.length === 0}
            <div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground italic">
              No test cases added to this suite yet. Formulate case details below.
            </div>
          {:else}
            <div class="flex flex-col gap-4">
              {#each displayTestCases as tc, idx (idx)}
                <div
                  class="flex flex-col gap-3 rounded-xl border bg-muted/10 p-4 transition-all duration-200 hover:border-primary/30"
                  transition:slide
                >
                  <div class="flex items-center justify-between">
                    <span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary"
                      >Test Case #{idx + 1}</span
                    >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                      onclick={() => removeLocalTestCase(idx)}
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <div class="flex flex-col gap-1">
                      <span class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">Input</span>
                      <pre
                        class="overflow-x-auto rounded border border-border/40 bg-background p-2.5 font-mono text-xs whitespace-pre-wrap">{tc.inputData ||
                          '[Empty Input]'}</pre>
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
                        >Expected Output</span
                      >
                      <pre
                        class="overflow-x-auto rounded border border-border/40 bg-background p-2.5 font-mono text-xs whitespace-pre-wrap">{tc.outputData}</pre>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Form to append test cases -->
          <div class="flex flex-col gap-4 rounded-xl border bg-muted/5 p-4">
            <h4 class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Create Custom Case</h4>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label for="new-input" class="text-xs font-semibold">stdin</Label>
                <Textarea
                  id="new-input"
                  placeholder="Input arguments or strings (optional)..."
                  bind:value={newCaseInput}
                  rows={3}
                  class="border-primary/20 font-mono text-xs focus-visible:ring-primary/30"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="new-output" class="text-xs font-semibold text-primary">stdout</Label>
                <Textarea
                  id="new-output"
                  placeholder="Console output sequence..."
                  bind:value={newCaseOutput}
                  rows={3}
                  required
                  class="border-primary/20 font-mono text-xs focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onclick={addLocalTestCase}
                disabled={!newCaseOutput.trim()}
                class="cursor-pointer gap-1.5 font-bold"
              >
                <Plus class="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Publish Actions -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onclick={() => goto('/problems')}
          disabled={isSubmitting}
          class="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onclick={handleSubmit}
          disabled={isSubmitting || !title.trim() || !contentMd.replace(/<[^>]*>/g, '').trim()}
          class="min-w-36 cursor-pointer font-bold shadow-sm"
        >
          {#if isSubmitting}
            <Spinner class="size-4" /> Creating...
          {:else}
            Publish Problem
          {/if}
        </Button>
      </div>
    </div>
  {/if}
</PageLayout>

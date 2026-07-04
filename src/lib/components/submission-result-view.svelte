<script lang="ts">
  import * as Tabs from '$lib/components/ui/tabs/index.js';
  import type { SubmissionResult } from '$lib/server/judge0';

  let {
    result,
    showTabs = false,
  }: {
    result: SubmissionResult;
    showTabs?: boolean;
  } = $props();

  let activeTab = $state('stdout');

  $effect(() => {
    if (result.compile_output) {
      activeTab = 'compile_output';
    } else if (result.stderr) {
      activeTab = 'stderr';
    } else {
      activeTab = 'stdout';
    }
  });
</script>

<div class="flex flex-col gap-2">
  {#if !showTabs}
    <!-- Compact View (used in playback test cases) -->
    <div class="mt-2 rounded-md bg-muted/30 p-2 text-xs">
      <div class="mb-1 font-medium text-muted-foreground">Actual Output:</div>
      <pre class="font-mono whitespace-pre-wrap">{result.stdout ?? 'No output'}</pre>

      {#if result.stderr}
        <div class="mt-2">
          <div class="mb-1 font-medium text-destructive">stderr:</div>
          <pre class="whitespace-pre-wrap text-destructive">{result.stderr}</pre>
        </div>
      {/if}

      {#if result.compile_output}
        <div class="mt-2">
          <div class="mb-1 font-medium text-destructive">compile:</div>
          <pre class="whitespace-pre-wrap text-destructive">{result.compile_output}</pre>
        </div>
      {/if}

      <div class="mt-2 flex gap-3 text-muted-foreground">
        {#if result.time != null}
          <span>{result.time}s</span>
        {/if}
        {#if result.memory != null}
          <span>{(result.memory / 1024).toFixed(1)}MB</span>
        {/if}
        {#if result.status}
          <span class="status-badge ml-auto">{result.status.description}</span>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Tabbed View (used in main problem route) -->
    <Tabs.Root bind:value={activeTab} class="flex flex-col overflow-hidden">
      <Tabs.List class="h-auto w-full shrink-0 justify-start rounded-none border-b bg-transparent p-0 pb-2">
        <Tabs.Trigger value="stdout" class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          Stdout
        </Tabs.Trigger>
        <Tabs.Trigger value="stderr" class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          Stderr
        </Tabs.Trigger>
        <Tabs.Trigger
          value="compile_output"
          class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Compile
        </Tabs.Trigger>
        <Tabs.Trigger
          value="message"
          class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Message
        </Tabs.Trigger>
      </Tabs.List>

      <div class="mt-2 flex-1 overflow-auto rounded-md bg-muted/30 p-2 font-mono text-sm">
        <Tabs.Content value="stdout" class="m-0 h-full outline-none">
          <pre class="whitespace-pre-wrap">{result.stdout || 'No standard output'}</pre>
        </Tabs.Content>

        <Tabs.Content value="stderr" class="m-0 h-full outline-none">
          {#if result.stderr}
            <pre class="whitespace-pre-wrap text-destructive">{result.stderr}</pre>
          {:else}
            <pre class="whitespace-pre-wrap text-success">No standard error</pre>
          {/if}
        </Tabs.Content>

        <Tabs.Content value="compile_output" class="m-0 h-full outline-none">
          {#if result.compile_output}
            <pre class="whitespace-pre-wrap text-destructive">{result.compile_output}</pre>
          {:else}
            <pre class="whitespace-pre-wrap text-success">No compilation errors</pre>
          {/if}
        </Tabs.Content>

        <Tabs.Content value="message" class="m-0 h-full outline-none">
          <pre class="whitespace-pre-wrap">{result.message || 'No additional messages'}</pre>
          <div class="mt-4 grid grid-cols-[100px_1fr] gap-1 text-xs">
            {#if result.status}
              <div class="font-semibold text-muted-foreground">Status:</div>
              <div class="status-badge">{result.status.description}</div>
            {/if}
            {#if result.time != null}
              <div class="font-semibold text-muted-foreground">Time:</div>
              <div>{result.time} s</div>
            {/if}
            {#if result.wall_time != null}
              <div class="font-semibold text-muted-foreground">Wall Time:</div>
              <div>{result.wall_time} s</div>
            {/if}
            {#if result.memory != null}
              <div class="font-semibold text-muted-foreground">Memory:</div>
              <div>{(result.memory / 1024).toFixed(2)} MB</div>
            {/if}
            {#if result.exit_code != null}
              <div class="font-semibold text-muted-foreground">Exit Code:</div>
              <div>{result.exit_code}</div>
            {/if}
          </div>
        </Tabs.Content>
      </div>
    </Tabs.Root>
  {/if}
</div>

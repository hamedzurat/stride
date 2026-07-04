<script lang="ts">
  import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
  import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
  import ClockIcon from '@lucide/svelte/icons/clock';
  import InfoIcon from '@lucide/svelte/icons/info';
  import MonitorOffIcon from '@lucide/svelte/icons/monitor-off';
  import RadioIcon from '@lucide/svelte/icons/radio';
  import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
  import Settings2Icon from '@lucide/svelte/icons/settings-2';
  import TvIcon from '@lucide/svelte/icons/tv';
  import { useQuery } from 'convex-svelte';

  import { api } from '$convex/_generated/api.js';

  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Select from '$lib/components/ui/select/index.js';
  import { session } from '$lib/session';
  import { screenShareState } from '$lib/sharescreen.svelte';

  // Reactively derive student ID from session
  const studentId = $derived($session?.userId || '');

  // Query all sections the student is enrolled in
  const sectionsQuery = useQuery(api.sections.listSectionsByStudent, () => (studentId ? { studentId } : 'skip'));
  const sections = $derived(sectionsQuery.data ?? []);

  // Reactively derive currently selected section name
  const selectedSection = $derived(sections.find((s) => s?._id === screenShareState.sectionId));

  // Automatically select the first section as a default if not set
  $effect(() => {
    if (sections.length > 0 && !screenShareState.sectionId) {
      screenShareState.sectionId = sections[0]?._id || undefined;
    }
  });

  let videoElement = $state<HTMLVideoElement | null>(null);

  // Bind video element to media stream when active
  $effect(() => {
    if (videoElement) {
      videoElement.srcObject = screenShareState.stream;
      if (screenShareState.stream) {
        videoElement.play().catch(console.error);
      }
    }
  });

  async function startSharing() {
    if (screenShareState.startSharing) {
      await screenShareState.startSharing();
    }
  }

  function stopSharing() {
    if (screenShareState.stopSharing) {
      screenShareState.stopSharing();
    }
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<PageLayout>
  <PageHero title="Screen Share Setup" description="Classroom Hub — Live Screen Capture" />

  <!-- 2. Screen Share Control Card -->
  <div class="flex flex-col gap-6 rounded-2xl border border-border/40 bg-card/45 p-6 shadow-xl backdrop-blur-md">
    <h2 class="text-base font-bold text-foreground">Screen Share Control</h2>

    <!-- Section Select Dropdown -->
    <div class="flex flex-col gap-2">
      <label for="section-select" class="text-xs font-semibold text-muted-foreground">Share to Section</label>
      {#if sectionsQuery.isLoading}
        <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
      {:else if sections.length === 0}
        <div class="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          You are not registered in any sections.
        </div>
      {:else}
        <Select.Root type="single" bind:value={screenShareState.sectionId} disabled={screenShareState.sharing}>
          <Select.Trigger class="w-full border border-border bg-background">
            {selectedSection?.name ?? 'Select a section'}
          </Select.Trigger>
          <Select.Content class="border border-border bg-card">
            {#each sections as section (section?._id)}
              {#if section}
                <Select.Item value={section._id} label={section.name}>
                  {section.name}
                </Select.Item>
              {/if}
            {/each}
          </Select.Content>
        </Select.Root>
      {/if}
    </div>

    <!-- Resolution & FPS Select Dropdowns -->
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <label for="resolution-select" class="text-xs font-semibold text-muted-foreground">Resolution</label>
        <Select.Root type="single" bind:value={screenShareState.resolution} disabled={screenShareState.sharing}>
          <Select.Trigger class="w-full border border-border bg-background">
            {#if screenShareState.resolution === '1080p'}
              1080p (Full HD)
            {:else if screenShareState.resolution === '720p'}
              720p (HD)
            {:else if screenShareState.resolution === '480p'}
              480p (SD)
            {/if}
          </Select.Trigger>
          <Select.Content class="border border-border bg-card">
            <Select.Item value="1080p" label="1080p (Full HD)">1080p (Full HD)</Select.Item>
            <Select.Item value="720p" label="720p (HD)">720p (HD)</Select.Item>
            <Select.Item value="480p" label="480p (SD)">480p (SD)</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex flex-col gap-2">
        <label for="fps-select" class="text-xs font-semibold text-muted-foreground">Frame Rate</label>
        <Select.Root type="single" bind:value={screenShareState.frameRate} disabled={screenShareState.sharing}>
          <Select.Trigger class="w-full border border-border bg-background">
            {screenShareState.frameRate} FPS
          </Select.Trigger>
          <Select.Content class="border border-border bg-card">
            <Select.Item value="60" label="60 FPS">60 FPS</Select.Item>
            <Select.Item value="30" label="30 FPS">30 FPS</Select.Item>
            <Select.Item value="15" label="15 FPS">15 FPS</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
    </div>

    {#if screenShareState.errorMessage}
      <div
        class="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive"
      >
        <AlertCircleIcon class="mt-0.5 size-4 shrink-0" />
        <span>{screenShareState.errorMessage}</span>
      </div>
    {/if}

    <!-- Dynamic Session Stats Grid (Only when active) -->
    {#if screenShareState.sharing}
      <div
        class="grid animate-in grid-cols-2 gap-4 rounded-xl border border-border/30 bg-background/50 p-4 duration-300 fade-in slide-in-from-top-2"
      >
        <div class="flex items-center gap-3">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
            <ClockIcon class="size-4" />
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-bold text-muted-foreground uppercase">Session Timer</span>
            <span class="font-mono text-sm font-bold text-foreground"
              >{formatDuration(screenShareState.shareDuration)}</span
            >
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div
            class="flex size-8 shrink-0 animate-pulse items-center justify-center rounded-lg bg-success/10 text-success"
          >
            <RadioIcon class="size-4" />
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-bold text-muted-foreground uppercase">P2P Connection</span>
            <span class="text-xs font-semibold text-foreground">
              {screenShareState.peerConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>

        {#if screenShareState.actualWidth && screenShareState.actualHeight}
          <div class="flex items-center gap-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <TvIcon class="size-4" />
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-muted-foreground uppercase">Resolution</span>
              <span class="font-mono text-xs font-semibold text-foreground">
                {screenShareState.actualWidth}x{screenShareState.actualHeight}
              </span>
            </div>
          </div>
        {/if}

        {#if screenShareState.actualFPS}
          <div class="flex items-center gap-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
              <Settings2Icon class="size-4" />
            </div>
            <div class="flex flex-col">
              <span class="text-[10px] font-bold text-muted-foreground uppercase">Frame Rate</span>
              <span class="font-mono text-xs font-semibold text-foreground">
                {Math.round(screenShareState.actualFPS)} FPS
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Action Button -->
    <div class="flex flex-col gap-3">
      {#if !screenShareState.sharing}
        <Button
          onclick={startSharing}
          disabled={!studentId || sections.length === 0}
          class="w-full gap-2 font-semibold shadow-lg shadow-primary/20"
          aria-label="Start sharing screen"
        >
          <ScreenShareIcon class="size-4" />
          <span>Start Sharing</span>
        </Button>
      {:else}
        <Button
          variant="destructive"
          onclick={stopSharing}
          class="w-full animate-pulse gap-2 font-semibold shadow-lg shadow-destructive/20"
          aria-label="Stop sharing screen"
        >
          <MonitorOffIcon class="size-4" />
          <span>Stop Sharing</span>
        </Button>
      {/if}
    </div>

    <div class="border-t border-border/40"></div>

    <!-- Guidelines -->
    <div class="flex flex-col gap-4">
      <div class="flex gap-3 text-xs text-muted-foreground">
        <InfoIcon class="size-4 shrink-0 text-primary/70" />
        <p>
          Ensure you share your <strong>Entire Screen</strong> so that the teacher can watch properly during the active session.
        </p>
      </div>
      <div class="flex gap-3 text-xs text-muted-foreground">
        <CheckCircleIcon class="size-4 shrink-0 text-success/70" />
        <p>You can navigate to other tabs inside Stride; screen sharing will continue running in the background.</p>
      </div>
    </div>
  </div>

  <!-- 3. Live Preview Card -->
  <div class="flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/45 shadow-xl backdrop-blur-md">
    <!-- Preview Header -->
    <div class="flex items-center justify-between border-b border-border/40 bg-background/20 px-6 py-4">
      <span class="text-sm font-semibold text-foreground">Screen Preview</span>
      {#if screenShareState.sharing}
        <span
          class="flex animate-pulse items-center gap-1.5 rounded border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-success uppercase"
        >
          Live
        </span>
      {/if}
    </div>

    <!-- Video Frame -->
    <div class="relative flex min-h-[340px] items-center justify-center bg-background/40 p-6">
      <video
        bind:this={videoElement}
        muted
        autoplay
        playsinline
        class="aspect-video w-full rounded-lg border border-border/20 bg-pure-black/60 shadow-md transition-all duration-500 {screenShareState.sharing
          ? 'scale-100 opacity-100'
          : 'pointer-events-none absolute scale-95 opacity-0'}"
      ></video>

      {#if !screenShareState.sharing}
        <div class="flex max-w-sm flex-col items-center justify-center p-6 text-center">
          <div
            class="mb-4 flex size-16 items-center justify-center rounded-full border border-border/20 bg-muted/40 text-muted-foreground"
          >
            <ScreenShareIcon class="size-8 opacity-60" />
          </div>
          <h3 class="mb-1 text-sm font-bold text-foreground">Preview Offline</h3>
          <p class="text-xs text-muted-foreground">
            Your screen is not currently sharing. Click the "Start Sharing" button to begin your stream.
          </p>
        </div>
      {/if}
    </div>
  </div>
</PageLayout>

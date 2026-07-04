<script lang="ts">
  import BellIcon from '@lucide/svelte/icons/bell';
  import CctvIcon from '@lucide/svelte/icons/cctv';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
  import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
  import UsersIcon from '@lucide/svelte/icons/users';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import SimplePeer from 'simple-peer/simplepeer.min.js';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import { SvelteSet } from 'svelte/reactivity';

  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import { addEntry, getUnreadCount } from '$lib/audit-log';
  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';

  import AuditLogModal from './AuditLogModal.svelte';

  const client = useConvexClient();
  const sectionId = page.params.sectionId;
  const teacherTargetId = `${sectionId}_teacher`;
  const broadcastTargetId = `${sectionId}_broadcast_ping`;

  // Fetch Section Info
  const sectionQuery = useQuery(api.sections.get, () => ({ id: sectionId as Id<'sections'> }));

  // Fetch all enrolled students in the section
  const studentsQuery = useQuery(api.sections.listStudents, () => ({
    sectionId: sectionId as Id<'sections'>,
  }));

  // Listen to incoming WebRTC signals from students
  const incomingSignals = useQuery(api.signals.getFor, () => ({ to: teacherTargetId }));

  const sendSignal = (data: { from: string; to: string; type: string; data: string }) =>
    client.mutation(api.signals.send, data);
  const removeSignal = (data: { id: Id<'signals'> }) => client.mutation(api.signals.remove, data);

  // State Management
  interface StudentConnection {
    peer: SimplePeer.Instance;
    stream: MediaStream | null;
    status: 'connecting' | 'connected';
  }
  let activeStreams = $state<Record<string, StudentConnection>>({});
  let fullscreenStudentId = $state<string | null>(null);

  // Track processed signal IDs to prevent duplicate WebRTC negotiations
  const processedIds = new SvelteSet<string>();

  // Custom student list sorting and highlighting
  let customStudentOrder = $state<Id<'users'>[]>([]);
  let highlightedStudents = $state<Record<string, boolean>>({});
  const highlightTimers: Record<string, any> = {};

  // Audit log and screenshot state
  let videoElements = $state(new Map<string, HTMLVideoElement>());
  let showAuditLog = $state(false);
  let auditLogStudentId = $state<string | null>(null);
  let unreadCount = $state(0);
  let unfocusTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  let connectionTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

  // Load initial unread count on mount
  $effect(() => {
    getUnreadCount().then((c) => (unreadCount = c));
  });

  $effect(() => {
    const data = studentsQuery.data;
    if (data) {
      const newIds = data.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => s._id);
      untrack(() => {
        const filteredExisting = customStudentOrder.filter((id) => newIds.includes(id));
        const added = newIds.filter((id) => !filteredExisting.includes(id));
        customStudentOrder = [...filteredExisting, ...added];
      });
    }
  });

  function handleStudentTabSwitch(studentId: Id<'users'>) {
    // Check if the student is already in the first page
    const isAlreadyOnFirstPage = studentsList.slice(0, itemsPerPage).some((s) => s._id === studentId);

    if (!isAlreadyOnFirstPage) {
      // Move student to the top of the custom list
      const updatedOrder = customStudentOrder.filter((id) => id !== studentId);
      customStudentOrder = [studentId, ...updatedOrder];
    }

    // Always reset to first page so teacher sees the change/highlight
    currentPage = 1;

    // Trigger visual highlight
    highlightedStudents[studentId] = true;

    // Reset timer
    if (highlightTimers[studentId]) {
      clearTimeout(highlightTimers[studentId]);
    }
    highlightTimers[studentId] = setTimeout(() => {
      highlightedStudents[studentId] = false;
    }, 5000);
  }

  // Pagination State
  let currentPage = $state(1);
  const itemsPerPage = 6; // Elegant 2x3 grid layout (6 items per page)

  const studentsList = $derived(
    customStudentOrder
      .map((id) => (studentsQuery.data ?? []).find((s) => s?._id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined && s !== null),
  );
  const totalStudents = $derived(studentsList.length);
  const totalPages = $derived(Math.max(1, Math.ceil(totalStudents / itemsPerPage)));

  const paginatedStudents = $derived(studentsList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));

  const activeStreamCount = $derived(Object.values(activeStreams).filter((s) => s.status === 'connected').length);

  // Student lookup map for audit logging
  const studentMap = $derived(new Map(studentsList.map((s) => [s._id, s])));

  // Send broadcast ping to trigger student offers
  async function triggerBroadcastPing() {
    try {
      await sendSignal({
        from: 'teacher',
        to: broadcastTargetId,
        type: 'broadcast_ping',
        data: '{}',
      });
    } catch (_err) {
      toast.error('Failed to send broadcast ping to students.');
    }
  }

  // Trigger broadcast ping automatically on load
  $effect(() => {
    if (sectionQuery.data) {
      triggerBroadcastPing();
    }
  });

  // Handle incoming WebRTC signals
  $effect(() => {
    const sigs = incomingSignals?.data;
    if (!sigs) return;

    for (const sig of sigs) {
      if (processedIds.has(sig._id)) continue;
      processedIds.add(sig._id);

      const studentId = sig.from;
      const data = JSON.parse(sig.data);

      if (sig.type === 'offer') {
        // Cleanup existing connection for this student if any
        if (activeStreams[studentId]?.peer) {
          try {
            activeStreams[studentId].peer.destroy();
          } catch (err) {
            console.error(err);
          }
        }

        const peerInstance = new SimplePeer({ initiator: false, trickle: true });

        activeStreams = {
          ...activeStreams,
          [studentId]: {
            peer: peerInstance,
            stream: null,
            status: 'connecting',
          },
        };

        // Handle signaling responses back to the specific student
        peerInstance.on('signal', (outData) => {
          const type = outData.type === 'answer' ? 'answer' : 'ice';
          sendSignal({
            from: 'teacher',
            to: `${sectionId}_${studentId}`,
            type,
            data: JSON.stringify(outData),
          }).catch(console.error);
        });

        // Set live stream when WebRTC negotiation finishes
        peerInstance.on('stream', (s) => {
          if (activeStreams[studentId]) {
            if (connectionTimeouts[studentId]) {
              clearTimeout(connectionTimeouts[studentId]);
              delete connectionTimeouts[studentId];
            }
            activeStreams[studentId] = {
              ...activeStreams[studentId],
              stream: s,
              status: 'connected',
            };
            activeStreams = { ...activeStreams }; // Trigger Svelte 5 reactivity
          }
        });

        // Handle incoming data channel messages (P2P tab switch alerts)
        peerInstance.on('data', (rawVal) => {
          try {
            let str = '';
            if (typeof rawVal === 'string') {
              str = rawVal;
            } else if (rawVal instanceof Uint8Array || rawVal instanceof ArrayBuffer) {
              str = new TextDecoder('utf-8').decode(rawVal);
            } else {
              str = new TextDecoder('utf-8').decode(new Uint8Array(rawVal));
            }
            const msg = JSON.parse(str);
            if (msg.type === 'tab-switch') {
              handleStudentTabSwitch(studentId as Id<'users'>);
              logUnfocused(studentId as Id<'users'>);
            } else if (msg.type === 'focus-returned') {
              logFocusReturned(studentId as Id<'users'>);
            }
          } catch (err) {
            console.error(`Failed to parse P2P data from student ${studentId}:`, err);
          }
        });

        // Handle error and disconnects
        peerInstance.on('error', (_err) => {
          handlePeerDisconnect(studentId as Id<'users'>);
        });

        peerInstance.on('close', () => {
          handlePeerDisconnect(studentId as Id<'users'>);
        });

        peerInstance.signal(data);

        // Auto-cleanup if connection doesn't establish within 25s
        connectionTimeouts[studentId] = setTimeout(() => {
          const conn = activeStreams[studentId];
          if (conn && conn.status === 'connecting') {
            cleanupStudent(studentId);
          }
          delete connectionTimeouts[studentId];
        }, 25000);
      } else if (sig.type === 'ice') {
        if (activeStreams[studentId]?.peer) {
          activeStreams[studentId].peer.signal(data);
        }
      }

      // Delete the processed signal from database immediately
      removeSignal({ id: sig._id }).catch(console.error);
    }
  });

  function cleanupStudent(studentId: string) {
    if (activeStreams[studentId]) {
      const { peer, stream } = activeStreams[studentId];
      try {
        peer.destroy();
      } catch {
        /* ignore */
      }
      if (stream) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* ignore */
          }
        });
      }
      delete activeStreams[studentId];
      activeStreams = { ...activeStreams }; // Trigger Svelte 5 reactivity

      if (fullscreenStudentId === studentId) {
        fullscreenStudentId = null;
      }
      if (highlightTimers[studentId]) {
        clearTimeout(highlightTimers[studentId]);
        delete highlightTimers[studentId];
      }
      delete highlightedStudents[studentId];
    }
  }

  // Svelte Action to attach streams dynamically to video elements
  function attachStream(node: HTMLVideoElement, s: MediaStream | null) {
    function safePlay() {
      node.play().catch((err) => {
        if (err.name === 'AbortError') return;
        console.error(err);
      });
    }

    if (s) {
      node.srcObject = s;
      safePlay();
    }

    return {
      update(newStream: MediaStream | null) {
        node.srcObject = newStream;
        if (newStream) safePlay();
      },
      destroy() {
        node.srcObject = null;
      },
    };
  }

  // Svelte Action to store video element references for screenshot capture
  function storeVideoRef(node: HTMLVideoElement, studentId: string) {
    videoElements.set(studentId, node);
    return {
      destroy() {
        videoElements.delete(studentId);
      },
    };
  }

  // Capture a screenshot from a student's video element
  function captureScreenshot(studentId: string): string | null {
    const videoEl = videoElements.get(studentId);
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.5);
  }

  // Log an unfocused event with immediate screenshot + schedule a delayed capture
  async function logUnfocused(studentId: Id<'users'>) {
    const student = studentMap.get(studentId);
    if (!student) return;

    const screenshot = captureScreenshot(studentId);

    await addEntry({
      timestamp: Date.now(),
      studentId,
      studentName: student.name,
      studentAvatarUrl: student.avatarUrl,
      eventType: 'unfocused',
      screenshot: screenshot ?? undefined,
      read: false,
    });
    unreadCount++;

    // Schedule a second screenshot 10s later
    if (unfocusTimers[studentId]) {
      clearTimeout(unfocusTimers[studentId]);
    }
    unfocusTimers[studentId] = setTimeout(async () => {
      const laterScreenshot = captureScreenshot(studentId);
      if (laterScreenshot) {
        const s = studentMap.get(studentId);
        await addEntry({
          timestamp: Date.now(),
          studentId,
          studentName: s?.name || student.name,
          studentAvatarUrl: s?.avatarUrl || student.avatarUrl,
          eventType: 'unfocused',
          screenshot: laterScreenshot,
          read: false,
        });
        unreadCount++;
      }
      delete unfocusTimers[studentId];
    }, 10000);
  }

  // Log a focus returned event
  async function logFocusReturned(studentId: Id<'users'>) {
    const student = studentMap.get(studentId);
    if (!student) return;

    if (unfocusTimers[studentId]) {
      clearTimeout(unfocusTimers[studentId]);
      delete unfocusTimers[studentId];
    }

    await addEntry({
      timestamp: Date.now(),
      studentId,
      studentName: student.name,
      studentAvatarUrl: student.avatarUrl,
      eventType: 'focus_returned',
      read: true,
    });
  }

  // Log an offline event when a student's WebRTC connection drops
  async function logOffline(studentId: Id<'users'>) {
    const student = studentMap.get(studentId);
    if (!student) return;

    if (unfocusTimers[studentId]) {
      clearTimeout(unfocusTimers[studentId]);
      delete unfocusTimers[studentId];
    }

    await addEntry({
      timestamp: Date.now(),
      studentId,
      studentName: student.name,
      studentAvatarUrl: student.avatarUrl,
      eventType: 'offline',
      read: false,
    });
    unreadCount++;
  }

  // Called when a peer disconnects (logs offline then cleans up)
  function handlePeerDisconnect(studentId: Id<'users'>) {
    logOffline(studentId);
    cleanupStudent(studentId);
  }

  // Periodic screenshot capture every 30s for all active streams
  $effect(() => {
    const interval = setInterval(async () => {
      for (const [sid] of videoElements) {
        const conn = activeStreams[sid];
        if (conn?.status === 'connected' && conn.stream) {
          const screenshot = captureScreenshot(sid);
          if (screenshot) {
            const s = studentMap.get(sid as Id<'users'>);
            await addEntry({
              timestamp: Date.now(),
              studentId: sid,
              studentName: s?.name || 'Unknown',
              studentAvatarUrl: s?.avatarUrl,
              eventType: 'periodic_snapshot',
              screenshot,
              read: true,
            });
          }
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  });

  // Page level cleanup upon navigation or unmount
  $effect(() => {
    return () => {
      Object.keys(activeStreams).forEach((studentId) => {
        cleanupStudent(studentId);
      });
      Object.values(highlightTimers).forEach((timer) => clearTimeout(timer));
      Object.values(unfocusTimers).forEach((timer) => clearTimeout(timer));
      Object.values(connectionTimeouts).forEach((timer) => clearTimeout(timer));
    };
  });
</script>

{#if sectionQuery.isLoading}
  <PageLayout wide>
    <div class="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each [0, 1, 2, 3, 4, 5] as i (i)}
        <div
          class="flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/45 shadow-xl backdrop-blur-md"
        >
          <div class="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
            <Skeleton class="size-6 rounded-full" />
            <Skeleton class="h-4 w-24" />
          </div>
          <div class="flex aspect-video items-center justify-center bg-muted/20">
            <Skeleton class="size-12 rounded-full" />
          </div>
        </div>
      {/each}
    </div>
  </PageLayout>
{:else if !sectionQuery.data}
  <PageLayout wide>
    <PageHero title="CCTV Invigilation Hub" description="Screen Share Invigilator" />
    <!-- Empty state -->
    <div class="flex flex-1 flex-col items-center justify-center py-16">
      <CctvIcon class="mb-4 size-16 text-muted-foreground/60" />
      <h3 class="text-lg font-bold text-foreground">Section not found</h3>
      <p class="text-sm text-muted-foreground">This section may have been deleted.</p>
    </div>
  </PageLayout>
{:else}
  <PageLayout wide>
    <PageHero
      title={'CCTV Hub: ' + sectionQuery.data.name}
      description="Invigilation Dashboard &bull; Section Screen Sharing"
    >
      {#snippet actions()}
        <div class="flex items-center gap-3 rounded-xl border border-border/30 bg-background/50 px-4 py-2">
          <UsersIcon class="size-4 text-muted-foreground" />
          <span class="text-xs font-semibold text-muted-foreground">
            {activeStreamCount} / {totalStudents} Screens Active
          </span>
        </div>
        <button
          onclick={triggerBroadcastPing}
          class="flex cursor-pointer items-center justify-center rounded-xl border border-border/30 bg-background/50 p-2 text-muted-foreground transition-all duration-200 hover:bg-secondary"
          aria-label="Refresh All Streams"
          title="Refresh All Streams"
        >
          <RefreshCwIcon class="size-4" />
        </button>
        <button
          onclick={() => {
            auditLogStudentId = null;
            showAuditLog = true;
          }}
          class="relative flex cursor-pointer items-center justify-center rounded-xl border border-border/30 bg-background/50 p-2 text-muted-foreground transition-all duration-200 hover:bg-secondary"
          aria-label="Audit Log"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="size-4"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {#if unreadCount > 0}
            <span
              class="text-destructive-foreground absolute -top-1.5 -right-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-[9px] leading-none font-bold"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          {/if}
        </button>
      {/snippet}
    </PageHero>

    <!-- Primary CCTV Video Grid -->
    {#if studentsQuery.isLoading}
      <div class="flex flex-1 items-center justify-center">
        <Skeleton class="h-10 w-48" />
      </div>
    {:else if totalStudents === 0}
      <div
        class="my-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/25 p-6 text-center shadow-xl backdrop-blur-md"
      >
        <UsersIcon class="mb-4 size-16 text-muted-foreground/60" />
        <h3 class="mb-1 text-lg font-bold text-foreground">No Students Enrolled</h3>
        <p class="max-w-sm text-sm text-muted-foreground">
          There are currently no students enrolled in this section. Enroll students under section settings to invigilate
          their screens.
        </p>
      </div>
    {:else}
      <div class="mb-6 grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {#each paginatedStudents as student (student._id)}
          {@const connection = activeStreams[student._id]}
          {@const isLive = connection && connection.status === 'connected' && connection.stream}

          <div
            class="group relative flex h-fit flex-col overflow-hidden rounded-2xl border bg-card/45 shadow-xl backdrop-blur-md transition-all duration-500 {highlightedStudents[
              student._id
            ]
              ? 'scale-[1.02] animate-pulse border-destructive ring-2 shadow-destructive/20 ring-destructive ring-offset-2 ring-offset-background'
              : 'border-border/40'}"
          >
            <!-- Card Header details -->
            <div class="flex items-center justify-between border-b border-border/40 bg-background/20 px-4 py-3">
              <div class="flex max-w-[60%] items-center gap-2.5">
                {#if student.avatarUrl}
                  <img src={student.avatarUrl} alt={student.name} class="size-6 rounded-full border border-border/50" />
                {:else}
                  <div
                    class="flex size-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary"
                  >
                    {student.name.slice(0, 2).toUpperCase()}
                  </div>
                {/if}
                <span class="truncate text-xs font-bold text-foreground">{student.name}</span>
              </div>

              <div class="flex shrink-0 items-center gap-1">
                <button
                  onclick={() => {
                    auditLogStudentId = student._id;
                    showAuditLog = true;
                  }}
                  class="flex cursor-pointer items-center justify-center rounded-lg p-1 text-muted-foreground/50 transition-all duration-200 hover:text-primary"
                  title="Audit log for {student.name}"
                  aria-label="Audit log"
                >
                  <BellIcon class="size-3.5" />
                </button>

                <!-- Status Indicator Badge -->
                {#if isLive}
                  {#if highlightedStudents[student._id]}
                    <span
                      class="flex animate-bounce items-center gap-1 rounded border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-destructive uppercase"
                    >
                      Unfocused
                    </span>
                  {:else}
                    <span
                      class="flex animate-pulse items-center gap-1 rounded border border-success/20 bg-success/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-success uppercase"
                    >
                      Live
                    </span>
                  {/if}
                {:else if connection && connection.status === 'connecting'}
                  <span
                    class="flex animate-pulse items-center gap-1 rounded border border-warning/20 bg-warning/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-warning uppercase"
                  >
                    Connecting
                  </span>
                {:else}
                  <span
                    class="flex items-center gap-1 rounded border border-border/40 bg-muted/40 px-2 py-0.5 text-[9px] font-bold tracking-wider text-muted-foreground uppercase"
                  >
                    Offline
                  </span>
                {/if}
              </div>
            </div>

            <!-- Card Video Panel (Strict 16:9 Landscape Aspect Ratio) -->
            <div class="group/panel relative flex aspect-video w-full items-center justify-center bg-background/40">
              {#if isLive}
                <video
                  use:attachStream={connection.stream}
                  use:storeVideoRef={student._id}
                  muted
                  autoplay
                  playsinline
                  class="h-full w-full bg-pure-black object-contain"
                ></video>

                <!-- Hover Control Overlay -->
                <div
                  class="absolute inset-0 flex items-center justify-center gap-4 bg-pure-black/60 opacity-0 transition-opacity duration-200 group-hover/panel:opacity-100"
                >
                  <button
                    onclick={() => {
                      fullscreenStudentId = student._id;
                    }}
                    class="flex cursor-pointer items-center justify-center rounded-full bg-primary p-3 text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90"
                    title="Expand Fullscreen"
                    aria-label="Expand Fullscreen"
                  >
                    <Maximize2Icon class="size-4" />
                  </button>
                </div>
              {:else}
                <div class="flex flex-col items-center justify-center p-4 text-center">
                  <div
                    class="mb-2 flex size-10 items-center justify-center rounded-full border border-border/20 bg-muted/30 text-muted-foreground/60"
                  >
                    <ScreenShareIcon class="size-5" />
                  </div>
                  <p class="text-xs font-semibold text-muted-foreground/80">No Active Stream</p>
                  <p class="mt-0.5 max-w-[180px] text-[10px] text-muted-foreground/50">Waiting for the student...</p>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <!-- CCTV Pagination controls -->
      {#if totalPages > 1}
        <div
          class="mx-auto mt-auto flex w-full max-w-4xl items-center justify-center gap-2 border-t border-border/40 pt-6"
        >
          <button
            onclick={() => {
              currentPage = Math.max(1, currentPage - 1);
            }}
            disabled={currentPage === 1}
            class="flex cursor-pointer items-center justify-center rounded-lg border border-border/30 bg-card/45 p-2 text-foreground transition-all duration-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon class="size-4" />
          </button>

          {#each Array(totalPages) as _, i (i)}
            {@const pageNum = i + 1}
            <button
              onclick={() => {
                currentPage = pageNum;
              }}
              class="flex size-8 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-200 {currentPage ===
              pageNum
                ? 'scale-105 border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'border-border/30 bg-card/45 text-foreground hover:bg-secondary'}"
            >
              {pageNum}
            </button>
          {/each}

          <button
            onclick={() => {
              currentPage = Math.min(totalPages, currentPage + 1);
            }}
            disabled={currentPage === totalPages}
            class="flex cursor-pointer items-center justify-center rounded-lg border border-border/30 bg-card/45 p-2 text-foreground transition-all duration-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRightIcon class="size-4" />
          </button>
        </div>
      {/if}
    {/if}
  </PageLayout>
{/if}

<!-- CCTV Fullscreen Overlay Modal -->
{#if fullscreenStudentId}
  {@const fullscreenStudentObj = studentsList.find((s) => s?._id === fullscreenStudentId)}
  {@const fsConnection = activeStreams[fullscreenStudentId]}

  <div class="fixed inset-0 z-50 flex animate-in flex-col bg-pure-black/90 p-6 backdrop-blur-md duration-300 fade-in">
    <!-- Overlay Header -->
    <div class="mb-4 flex w-full items-center justify-between border-b border-border/20 pb-4">
      <div class="flex items-center gap-3">
        {#if fullscreenStudentObj?.avatarUrl}
          <img src={fullscreenStudentObj.avatarUrl} alt={fullscreenStudentObj.name} class="size-8 rounded-full" />
        {:else}
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary/25 text-xs font-bold text-primary"
          >
            {fullscreenStudentObj?.name.slice(0, 2).toUpperCase() || 'ST'}
          </div>
        {/if}
        <div>
          <h2 class="text-md font-bold text-pure-white">{fullscreenStudentObj?.name || 'Student Screen'}</h2>
          <p class="text-xs text-cinema-text">Fullscreen Invigilation Mode</p>
        </div>
      </div>

      <!-- Close overlay -->
      <button
        onclick={() => {
          fullscreenStudentId = null;
        }}
        class="flex cursor-pointer items-center justify-center rounded-xl border border-cinema-border bg-cinema-bg p-2.5 text-pure-white transition-all duration-200 hover:bg-cinema-border hover:text-pure-white"
        aria-label="Close fullscreen"
      >
        <Minimize2Icon class="size-4" />
      </button>
    </div>

    <!-- High-res overlay video frame -->
    <div
      class="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border/20 bg-pure-black/60"
    >
      {#if fsConnection && fsConnection.status === 'connected' && fsConnection.stream}
        <video
          use:attachStream={fsConnection.stream}
          use:storeVideoRef={fullscreenStudentId}
          muted
          autoplay
          playsinline
          class="h-full w-full object-contain"
        ></video>
      {:else}
        <div class="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <CircleAlertIcon class="mb-4 size-16 animate-pulse text-warning" />
          <h3 class="text-md font-bold text-pure-white">Stream Disconnected</h3>
          <p class="mt-1 max-w-xs text-xs text-cinema-text">
            The screen stream was interrupted or closed by the student.
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<AuditLogModal bind:open={showAuditLog} studentId={auditLogStudentId} />

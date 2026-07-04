<script lang="ts">
  import { useConvexClient, useQuery } from 'convex-svelte';
  import SimplePeer from 'simple-peer/simplepeer.min.js';
  import { SvelteSet } from 'svelte/reactivity';

  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import { session } from '$lib/session';
  import { screenShareState } from '$lib/sharescreen.svelte';

  const client = useConvexClient();

  // Derived state from session and global screenShareState
  const studentId = $derived($session?.userId || '');
  const sectionId = $derived(screenShareState.sectionId || '');

  const teacherTargetId = $derived(sectionId ? `${sectionId}_teacher` : '');
  const studentTargetId = $derived(sectionId && studentId ? `${sectionId}_${studentId}` : '');
  const broadcastTargetId = $derived(sectionId ? `${sectionId}_broadcast_ping` : '');

  // Convex queries for signaling
  const incomingSignals = useQuery(api.signals.getFor, () => (studentTargetId ? { to: studentTargetId } : 'skip'));
  const broadcastSignals = useQuery(api.signals.getFor, () => (broadcastTargetId ? { to: broadcastTargetId } : 'skip'));

  const sendSignal = (data: { from: string; to: string; type: string; data: string }) =>
    client.mutation(api.signals.send, data);
  const removeSignal = (data: { id: Id<'signals'> }) => client.mutation(api.signals.remove, data);

  // Track processed signal IDs
  const processedIds = new SvelteSet<string>();

  let lastNotificationTime = 0;
  let lastFocusReturnedTime = 0;
  function notifyTeacherOfTabSwitch() {
    if (!screenShareState.sharing || !screenShareState.peer || !screenShareState.peerConnected) return;
    const now = Date.now();
    if (now - lastNotificationTime < 3000) return; // throttle 3s
    lastNotificationTime = now;
    try {
      console.log('Sending tab-switch notification to teacher via P2P...');
      screenShareState.peer.send(JSON.stringify({ type: 'tab-switch' }));
    } catch (err) {
      console.error('Failed to send tab-switch notification via P2P:', err);
    }
  }

  function notifyTeacherOfFocusReturned() {
    if (!screenShareState.sharing || !screenShareState.peer || !screenShareState.peerConnected) return;
    const now = Date.now();
    if (now - lastFocusReturnedTime < 3000) return;
    lastFocusReturnedTime = now;
    try {
      screenShareState.peer.send(JSON.stringify({ type: 'focus-returned' }));
    } catch (err) {
      console.error('Failed to send focus-returned notification via P2P:', err);
    }
  }

  // Handle visibility change and blur/focus (student switching tabs)
  $effect(() => {
    if (!screenShareState.sharing || !screenShareState.peerConnected) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        notifyTeacherOfTabSwitch();
      } else {
        notifyTeacherOfFocusReturned();
      }
    }

    function handleBlur() {
      notifyTeacherOfTabSwitch();
    }

    function handleFocus() {
      notifyTeacherOfFocusReturned();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  });

  let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function clearConnectionTimeout() {
    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId);
      connectionTimeoutId = null;
    }
  }

  // Re-creates / starts WebRTC peer connection
  function restartPeerConnection() {
    clearConnectionTimeout();
    if (screenShareState.peer) {
      try {
        screenShareState.peer.destroy();
      } catch (err) {
        console.error('Error destroying peer:', err);
      }
      screenShareState.peer = null;
    }
    screenShareState.peerConnected = false;

    if (!screenShareState.stream || !studentId || !teacherTargetId) return;

    const p = new SimplePeer({ initiator: true, stream: screenShareState.stream, trickle: true });

    p.on('signal', (data) => {
      const type = data.type === 'offer' ? 'offer' : 'ice';
      sendSignal({
        from: studentId,
        to: teacherTargetId,
        type,
        data: JSON.stringify(data),
      }).catch(console.error);
    });

    p.on('connect', () => {
      clearConnectionTimeout();
      console.log('WebRTC connection established with teacher.');
      screenShareState.peerConnected = true;
    });

    p.on('close', () => {
      clearConnectionTimeout();
      screenShareState.peerConnected = false;
    });

    p.on('error', (err) => {
      clearConnectionTimeout();
      console.error('WebRTC peer error:', err);
      screenShareState.errorMessage = 'WebRTC connection dropped. Retrying...';
      screenShareState.peerConnected = false;
    });

    screenShareState.peer = p;

    // Auto-retry if connection doesn't establish within 20s
    connectionTimeoutId = setTimeout(() => {
      if (!screenShareState.peerConnected) {
        console.warn('WebRTC connection timed out. Retrying...');
        screenShareState.errorMessage = 'Connection timed out. Retrying...';
        restartPeerConnection();
      }
    }, 20000);
  }

  // Handle incoming signaling responses from teacher
  $effect(() => {
    const sigs = incomingSignals?.data;
    if (!sigs || !screenShareState.peer) return;

    for (const sig of sigs) {
      if (processedIds.has(sig._id)) continue;
      processedIds.add(sig._id);

      try {
        screenShareState.peer.signal(JSON.parse(sig.data));
      } catch (err) {
        console.error('Error signaling peer:', err);
      }
      removeSignal({ id: sig._id }).catch(console.error);
    }
  });

  // Handle teacher joining/refreshing (broadcast ping)
  $effect(() => {
    const sigs = broadcastSignals?.data;
    if (!sigs) return;

    for (const sig of sigs) {
      if (processedIds.has(sig._id)) continue;
      processedIds.add(sig._id);

      if (screenShareState.sharing && screenShareState.stream) {
        console.log('Teacher joined. Sending WebRTC reconnection offer...');
        restartPeerConnection();
      }
      removeSignal({ id: sig._id }).catch(console.error);
    }
  });

  function getVideoConstraints(res: '1080p' | '720p' | '480p', fps: '60' | '30' | '15'): MediaTrackConstraints {
    const constraints: MediaTrackConstraints = {
      frameRate: { ideal: parseInt(fps, 10) },
    };
    if (res === '1080p') {
      constraints.width = { ideal: 1920 };
      constraints.height = { ideal: 1080 };
    } else if (res === '720p') {
      constraints.width = { ideal: 1280 };
      constraints.height = { ideal: 720 };
    } else if (res === '480p') {
      constraints.width = { ideal: 854 };
      constraints.height = { ideal: 480 };
    }
    return constraints;
  }

  // Start display media capture
  async function startSharing() {
    screenShareState.errorMessage = null;
    if (!screenShareState.sectionId) {
      screenShareState.errorMessage = 'Please select a section to share to.';
      return;
    }
    try {
      console.log(
        'Requesting display media with quality:',
        screenShareState.resolution,
        '@',
        screenShareState.frameRate,
        'fps',
      );
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          ...getVideoConstraints(screenShareState.resolution, screenShareState.frameRate),
        },
        audio: false,
      });

      screenShareState.stream = s;
      screenShareState.status = 'sharing';
      screenShareState.sharing = true;

      // Extract actual media track settings for stats display
      const track = s.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        screenShareState.actualWidth = settings.width || null;
        screenShareState.actualHeight = settings.height || null;
        screenShareState.actualFPS = settings.frameRate || null;

        // Handle user stopping screen share via browser prompt bar
        track.onended = () => {
          stopSharing();
        };
      }

      restartPeerConnection();
    } catch (err: any) {
      console.error('Display media request rejected:', err);
      screenShareState.errorMessage =
        err.name === 'NotAllowedError'
          ? 'Screen capture permission was denied.'
          : err.message || 'Failed to capture screen.';
      screenShareState.status = 'disconnected';
      screenShareState.sharing = false;
    }
  }

  // Stop screen sharing and clean up
  function stopSharing() {
    console.log('Stopping screen sharing...');
    screenShareState.peerConnected = false;
    if (screenShareState.peer) {
      try {
        screenShareState.peer.destroy();
      } catch (err) {
        console.error('Error destroying peer on stop:', err);
      }
      screenShareState.peer = null;
    }

    if (screenShareState.stream) {
      screenShareState.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.error(err);
        }
      });
      screenShareState.stream = null;
    }

    screenShareState.sharing = false;
    screenShareState.status = 'disconnected';
    screenShareState.errorMessage = null;
    screenShareState.actualWidth = null;
    screenShareState.actualHeight = null;
    screenShareState.actualFPS = null;
    screenShareState.shareDuration = 0;
  }

  // Manage share duration timer interval
  let timerInterval: any = null;
  $effect(() => {
    if (screenShareState.sharing) {
      screenShareState.shareDuration = 0;
      timerInterval = setInterval(() => {
        screenShareState.shareDuration += 1;
      }, 1000);
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      screenShareState.shareDuration = 0;
    }
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };
  });

  // Bind actions to global state class instance
  $effect(() => {
    screenShareState.startSharing = startSharing;
    screenShareState.stopSharing = stopSharing;
    return () => {
      screenShareState.startSharing = null;
      screenShareState.stopSharing = null;
    };
  });

  // Clean up on component destroy (e.g. log out or layout unmount)
  $effect(() => {
    return () => {
      stopSharing();
    };
  });
</script>

import type { Id } from '$convex/_generated/dataModel';

export class ScreenShareState {
  sharing = $state(false);
  peerConnected = $state(false);
  status = $state<'disconnected' | 'ready' | 'sharing'>('disconnected');
  errorMessage = $state<string | null>(null);
  stream = $state<MediaStream | null>(null);
  sectionId = $state<Id<'sections'> | undefined>(undefined);
  peer = $state<any>(null);

  // Quality and session stats properties
  resolution = $state<'1080p' | '720p' | '480p'>('720p');
  frameRate = $state<'60' | '30' | '15'>('30');
  shareDuration = $state(0);
  actualWidth = $state<number | null>(null);
  actualHeight = $state<number | null>(null);
  actualFPS = $state<number | null>(null);

  // Bindable action delegates
  startSharing = $state<(() => Promise<void>) | null>(null);
  stopSharing = $state<(() => void) | null>(null);
}

export const screenShareState = new ScreenShareState();

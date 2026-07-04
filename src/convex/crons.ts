import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval('cleanup_old_pending_images', { hours: 24 }, internal.uploadedImages.cleanupOldPendingImages);

crons.interval('cleanup_stale_presence', { minutes: 15 }, internal.presence.cleanupStalePresence);

crons.interval('cleanup_stale_typing', { minutes: 5 }, internal.presence.cleanupStaleTyping);

export default crons;

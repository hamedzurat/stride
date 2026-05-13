<script lang="ts">
  import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
  import Code2Icon from '@lucide/svelte/icons/code-2';
  import XCircleIcon from '@lucide/svelte/icons/x-circle';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { RecentSubmission } from '$lib/types/dashboard';

  let { submissions }: { submissions: RecentSubmission[] } = $props();

  function timeAgo(date: number | string) {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + 'y ago';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + 'mo ago';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + 'd ago';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm ago';
    return Math.floor(seconds) + 's ago';
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg">
      <Code2Icon class="size-5 text-primary" />
      Recent Submissions
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <div class="space-y-4">
      {#each submissions as submission (submission._id)}
        <div class="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
          <div class="flex items-center gap-3">
            <div
              class="flex size-8 items-center justify-center rounded-full {submission.judgeVerdict === 'Accepted'
                ? 'bg-green-100 text-green-600'
                : 'bg-red-100 text-red-600'}"
            >
              {#if submission.judgeVerdict === 'Accepted'}
                <CheckCircle2Icon class="size-4" />
              {:else}
                <XCircleIcon class="size-4" />
              {/if}
            </div>
            <div>
              <p class="text-sm font-medium">{submission.problemTitle}</p>
              <p class="text-xs text-muted-foreground">{submission.activityTitle} • {submission.languageId}</p>
            </div>
          </div>
          <div class="text-right">
            <Badge variant="outline" class="mb-1 text-[10px]">
              {submission.judgeVerdict}
            </Badge>
            <p class="text-[10px] text-muted-foreground">{timeAgo(submission.submittedAt)}</p>
          </div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>

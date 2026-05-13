<script lang="ts">
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Clock from '@lucide/svelte/icons/clock';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import User from '@lucide/svelte/icons/user';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { AttentionItem } from '$lib/types/dashboard';

  let { items }: { items: AttentionItem[] } = $props();

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'high':
        return 'text-destructive bg-destructive/10 border-destructive/20';
      case 'medium':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'low':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      default:
        return 'text-muted-foreground bg-muted border-muted';
    }
  }

  function getReasonIcon(reason: string) {
    switch (reason) {
      case 'struggling':
        return AlertCircle;
      case 'late':
        return Clock;
      case 'pending_review':
        return CheckCircle2;
      default:
        return AlertCircle;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg font-bold">
      <AlertCircle class="size-5 text-destructive" />
      Needs Attention
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-4">
      {#each items as item (item._id)}
        <div
          class="group relative flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-muted/50">
                <User class="size-5 text-muted-foreground" />
              </div>
              <div class="flex flex-col">
                <h4 class="text-sm leading-tight font-bold">{item.studentName}</h4>
                <p class="text-[10px] font-medium text-muted-foreground uppercase">{item.problemTitle}</p>
              </div>
            </div>
            <Badge class="text-[9px] font-bold tracking-widest uppercase {getSeverityColor(item.severity)}">
              {item.severity} Priority
            </Badge>
          </div>

          <div class="flex items-start gap-3 rounded-xl bg-muted/20 p-3">
            <svelte:component
              this={getReasonIcon(item.reason)}
              class="mt-0.5 size-4 {item.reason === 'struggling' ? 'text-destructive' : 'text-muted-foreground'}"
            />
            <div class="flex flex-col gap-1">
              <p class="text-[10px] font-bold text-muted-foreground uppercase">
                {item.reason.replace('_', ' ')}
              </p>
              <p class="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] font-medium text-muted-foreground">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              class="flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:underline"
            >
              View Activity <ExternalLink class="size-3" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>

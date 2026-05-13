<script lang="ts">
  import MessageSquareIcon from '@lucide/svelte/icons/message-square';
  import MessagesSquareIcon from '@lucide/svelte/icons/messages-square';

  import * as Card from '$lib/components/ui/card/index.js';
  import type { ForumHighlight } from '$lib/types/dashboard';

  let { highlights }: { highlights: ForumHighlight[] } = $props();

  function formatDate(date: number | string) {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-lg">
      <MessagesSquareIcon class="size-5 text-primary" />
      Forum Highlights
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-4">
      {#each highlights as post (post._id)}
        <div class="group flex flex-col gap-2 rounded-lg border p-4 transition-all hover:border-primary/50">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-primary">{post.authorName}</span>
            <span class="text-[10px] text-muted-foreground">{formatDate(post.createdAt)}</span>
          </div>
          <h3 class="font-semibold group-hover:text-primary">Community Post</h3>
          <p class="line-clamp-2 text-sm text-muted-foreground">{post.contentMd}</p>
          <div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquareIcon class="size-3" />
            {post.commentCount} replies
          </div>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>

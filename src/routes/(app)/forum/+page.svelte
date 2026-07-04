<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Calendar from '@lucide/svelte/icons/calendar';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Settings from '@lucide/svelte/icons/settings';
  import Share2 from '@lucide/svelte/icons/share-2';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Signature from '@lucide/svelte/icons/signature';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Tag from '@lucide/svelte/icons/tag';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { toast } from 'svelte-sonner';
  import { fade, slide } from 'svelte/transition';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import { FilterTabs, PageEmpty, PageHero, PageLayout } from '$lib/components/page/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';
  import { cn } from '$lib/utils';

  const client = useConvexClient();

  // State
  let activeSort = $state<'new' | 'top' | 'hot'>('new');
  let selectedTagIds = $state<Id<'tags'>[]>([]);
  let showOnlyMyPosts = $state(false);
  let postToDeleteId = $state<Id<'posts'> | null>(null);
  let deletePostDialogOpen = $state(false);

  // Manage tags state
  let manageTagsDialogOpen = $state(false);
  let newTagName = $state('');
  let editingTagId = $state<Id<'tags'> | null>(null);
  let editingTagName = $state('');
  let isCreatingTag = $state(false);
  let isUpdatingTag = $state(false);
  let isDeletingTag = $state(false);
  let isDeletingPost = $state(false);

  // Queries
  const postsQuery = useQuery(api.posts.list, () => ({
    userId: $session?.userId || undefined,
    tagIds: selectedTagIds,
    sortBy: activeSort,
    onlyMyPosts: showOnlyMyPosts || undefined,
  }));

  const tagsQuery = useQuery(api.posts.listTags, () => ({}));

  // Voting action
  async function vote(postId: Id<'posts'>, value: 1 | -1 | 0, currentVote: number) {
    if (!$session?.userId) return;
    // Determine target vote value (toggle off if clicked same)
    const nextVoteValue = currentVote === value ? 0 : value;

    try {
      await client.mutation(api.posts.vote, {
        postId,
        userId: $session.userId,
        value: nextVoteValue,
      });
    } catch (_err) {
      toast.error('Failed to vote.');
    }
  }

  function deletePost(e: Event, postId: Id<'posts'>) {
    e.stopPropagation();
    postToDeleteId = postId;
    deletePostDialogOpen = true;
  }

  async function confirmDeletePost() {
    if (!postToDeleteId || isDeletingPost) return;
    isDeletingPost = true;
    try {
      await client.mutation(api.posts.remove, { id: postToDeleteId });
      toast.success('Post deleted successfully.');
      toast.error('Failed to delete post.');
    } finally {
      postToDeleteId = null;
      deletePostDialogOpen = false;
      isDeletingPost = false;
    }
  }

  function formatTime(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    isCreatingTag = true;
    try {
      const cleanedName = newTagName.trim().toLowerCase().replace(/#/g, '');
      await client.mutation(api.posts.createTag, { name: cleanedName });
      toast.success('Tag created successfully.');
      newTagName = '';
      toast.error('Failed to create tag.');
    } finally {
      isCreatingTag = false;
    }
  }

  async function handleUpdateTag(tagId: Id<'tags'>) {
    if (!editingTagName.trim()) return;
    isUpdatingTag = true;
    try {
      const cleanedName = editingTagName.trim().toLowerCase().replace(/#/g, '');
      await client.mutation(api.posts.updateTag, { id: tagId, name: cleanedName });
      toast.success('Tag updated successfully.');
      editingTagId = null;
      editingTagName = '';
      toast.error('Failed to update tag.');
    } finally {
      isUpdatingTag = false;
    }
  }

  function startEditingTag(tag: any) {
    editingTagId = tag._id;
    editingTagName = tag.name;
  }

  async function handleDeleteTag(tagId: Id<'tags'>) {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) return;
    isDeletingTag = true;
    try {
      await client.mutation(api.posts.deleteTag, { id: tagId });
      toast.success('Tag deleted successfully.');
      selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
      toast.error('Failed to delete tag.');
    } finally {
      isDeletingTag = false;
    }
  }
</script>

<PageLayout>
  <!-- Wide Hero -->
  <PageHero title="Stride Community Forum" description="Discuss programming, share problems, and help your peers.">
    {#snippet actions()}
      <Button onclick={() => goto('/forum/new')} size="lg" class="font-semibold shadow-sm">
        <Plus class="size-4" />
        Create Post
      </Button>
    {/snippet}
  </PageHero>

  <div class="flex flex-row items-start gap-6">
    <!-- Main Feed Area -->
    <div class="flex flex-1 flex-col gap-6">
      <!-- Sort Tabs + My Posts toggle -->
      <div class="flex items-center gap-2">
        {#if $session?.userId}
          <div class="flex items-center gap-1.5 rounded-lg border bg-muted/20 p-1">
            <button
              onclick={() => (showOnlyMyPosts = !showOnlyMyPosts)}
              class={cn(
                'cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                showOnlyMyPosts ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Signature class="mr-1 inline-block h-3.5 w-3.5" />
              My Posts
            </button>
          </div>
        {/if}
        <FilterTabs
          tabs={[
            { label: 'New', value: 'new' },
            { label: 'Hot', value: 'hot' },
            { label: 'Top', value: 'top' },
          ]}
          bind:activeTab={activeSort}
        />
      </div>

      <!-- Active Tag Indicator -->
      {#if selectedTagIds.length > 0}
        <div
          class="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2"
          transition:slide={{ duration: 200 }}
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium">Filtering by Tags:</span>
            {#if tagsQuery.data}
              {#each selectedTagIds as tagId (tagId)}
                {@const tag = tagsQuery.data.find((t) => t?._id === tagId)}
                {#if tag}
                  <Badge class="border-primary/30 bg-primary/20 text-primary hover:bg-primary/25">#{tag.name}</Badge>
                {/if}
              {/each}
            {/if}
          </div>
          <Button variant="ghost" size="sm" onclick={() => (selectedTagIds = [])} class="h-8 px-2 text-xs"
            >Clear Filter</Button
          >
        </div>
      {/if}

      <!-- Posts Feed -->
      <div class="flex flex-col gap-4">
        {#if postsQuery.isLoading}
          <div class="flex flex-col gap-4">
            {#each [0, 1, 2] as i (i)}
              <Card.Root class="overflow-hidden border-border">
                <div class="flex">
                  <div class="flex w-12 flex-col items-center gap-1 border-r bg-muted/10 p-3">
                    <Skeleton class="h-5 w-5 rounded" />
                    <Skeleton class="h-4 w-6" />
                    <Skeleton class="h-5 w-5 rounded" />
                  </div>
                  <Card.Content class="flex flex-1 flex-col gap-3 p-5">
                    <div class="flex items-center gap-2">
                      <Skeleton class="h-5 w-5 rounded-full" />
                      <Skeleton class="h-3 w-24" />
                      <Skeleton class="h-3 w-16" />
                    </div>
                    <Skeleton class="h-6 w-3/4" />
                    <Skeleton class="h-4 w-full" />
                    <Skeleton class="h-4 w-1/2" />
                    <div class="flex items-center gap-4">
                      <Skeleton class="h-4 w-20" />
                      <Skeleton class="h-4 w-16" />
                    </div>
                  </Card.Content>
                </div>
              </Card.Root>
            {/each}
          </div>
        {:else if !postsQuery.data || postsQuery.data.length === 0}
          <PageEmpty
            icon={Sparkles}
            title="No posts found"
            description="Be the first to ask a question, start a discussion, or share some insights with the community."
            action={{ label: 'Create Post', onclick: () => goto('/forum/new') }}
          />
        {:else}
          {#each postsQuery.data as post (post._id)}
            {#if post}
              <div in:fade>
                <Card.Root
                  class="group cursor-pointer overflow-hidden border-border transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                  onclick={() => post._id && goto(`/forum/${post._id}`)}
                >
                  <div class="flex">
                    <!-- Vote Controller (Left panel) -->
                    <div
                      class="flex w-12 flex-col items-center justify-start gap-1 border-r bg-muted/10 p-3 transition-all group-hover:bg-muted/15"
                    >
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          if (post._id) vote(post._id, 1, post.userVote ?? 0);
                        }}
                        class={cn(
                          'rounded p-1 transition-colors hover:bg-muted',
                          post.userVote === 1 ? 'text-warning hover:bg-warning/10' : 'text-muted-foreground',
                        )}
                        aria-label="Upvote"
                      >
                        <ArrowUp class="h-5 w-5 font-bold" />
                      </button>
                      <span
                        class={cn(
                          'text-sm font-bold tracking-tight',
                          post.userVote === 1 && 'text-warning',
                          post.userVote === -1 && 'text-info',
                          post.userVote === 0 && 'text-foreground/80',
                        )}
                      >
                        {post.score ?? 0}
                      </span>
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          if (post._id) vote(post._id, -1, post.userVote ?? 0);
                        }}
                        class={cn(
                          'rounded p-1 transition-colors hover:bg-muted',
                          post.userVote === -1 ? 'text-info hover:bg-info/10' : 'text-muted-foreground',
                        )}
                        aria-label="Downvote"
                      >
                        <ArrowDown class="h-5 w-5" />
                      </button>
                    </div>

                    <!-- Main Card Content -->
                    <Card.Content class="flex flex-1 flex-col gap-3 p-5">
                      <!-- Meta Header -->
                      <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <div class="flex items-center gap-2">
                          <Avatar.Root class="h-5 w-5 border shadow-sm">
                            <Avatar.Image src={post.authorAvatar ?? undefined} />
                            <Avatar.Fallback class="bg-primary/5 text-[8px]">
                              {post.authorName.substring(0, 2).toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span class="font-semibold text-foreground/80">{post.authorName}</span>
                          <span>•</span>
                          <span>{formatTime(post._creationTime ?? Date.now())}</span>
                        </div>

                        <!-- Delete button if authorized -->
                        {#if $session?.userId && (post.authorId === $session.userId || $session.role === 'admin' || $session.role === 'teacher')}
                          <Button
                            onclick={(e) => post._id && deletePost(e, post._id)}
                            variant="ghost"
                            size="sm"
                            class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete Post"
                          >
                            <Trash2 class="size-4" />
                          </Button>
                        {/if}
                      </div>

                      <!-- Post Title -->
                      <h2
                        class="text-lg leading-snug font-bold tracking-tight text-foreground transition-colors group-hover:text-primary"
                      >
                        {post.title ?? 'Untitled Post'}
                      </h2>

                      <!-- Text preview (strip HTML tags for plain text snippet) -->
                      <p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {(post.contentMd || '').replace(/<[^>]*>/g, '')}
                      </p>

                      <!-- Image Preview -->
                      {#if post.imageUrl}
                        <div class="mt-2 max-h-72 overflow-hidden rounded-lg border bg-muted/5">
                          <img src={post.imageUrl} alt={post.title} class="h-full w-full object-cover" loading="lazy" />
                        </div>
                      {/if}

                      <!-- Tags -->
                      {#if post.tags && post.tags.length > 0}
                        <div class="mt-1 flex flex-wrap gap-1.5">
                          {#each post.tags as tag (tag?._id)}
                            {#if tag}
                              <button
                                onclick={(e) => {
                                  e.stopPropagation();
                                  if (selectedTagIds.includes(tag._id)) {
                                    selectedTagIds = selectedTagIds.filter((id) => id !== tag._id);
                                  } else {
                                    selectedTagIds = [...selectedTagIds, tag._id];
                                  }
                                }}
                                class="inline-block"
                              >
                                <Badge
                                  variant="secondary"
                                  class="border text-xs font-normal hover:bg-muted-foreground/10"
                                >
                                  #{tag.name}
                                </Badge>
                              </button>
                            {/if}
                          {/each}
                        </div>
                      {/if}

                      <!-- Footer stats -->
                      <div class="mt-2 flex items-center gap-4 text-xs font-medium text-muted-foreground">
                        <div class="flex items-center gap-1 transition-colors hover:text-foreground">
                          <MessageSquare class="h-4 w-4" />
                          <span>{post.commentCount ?? 0} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
                        </div>
                        <div class="flex items-center gap-1 transition-colors hover:text-foreground">
                          <Share2 class="h-4 w-4" />
                          <span>Share</span>
                        </div>
                      </div>
                    </Card.Content>
                  </div>
                </Card.Root>
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>

    <!-- Sidebar Columns -->
    <div class="sticky top-20 hidden w-80 shrink-0 flex-col gap-6 lg:flex">
      <!-- Community guidelines -->
      <div class="relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex items-center gap-2 text-sm font-bold tracking-wider text-warning uppercase">
          <ShieldAlert class="h-4 w-4" />
          Community Rules
        </div>
        <Separator />
        <ul class="flex list-decimal flex-col gap-2 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>Be respectful and support your classmates.</li>
          <li>Do not share complete source code for exams.</li>
          <li>Use clear titles and add descriptive images when reporting compiler errors.</li>
          <li>Categorize your posts with appropriate tags.</li>
        </ul>
      </div>

      <!-- Tags Cloud -->
      <div class="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-1.5 text-sm font-bold tracking-wider text-muted-foreground uppercase">
            <Tag class="h-4 w-4" />
            Tags
          </h3>
          <div class="flex items-center gap-1">
            {#if selectedTagIds.length > 0}
              <Button
                variant="ghost"
                size="sm"
                class="h-7 cursor-pointer px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                onclick={() => (selectedTagIds = [])}
              >
                Reset
              </Button>
            {/if}
            {#if $session?.role === 'admin'}
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground"
                onclick={() => (manageTagsDialogOpen = true)}
                title="Manage Tags"
              >
                <Settings class="h-4 w-4" />
              </Button>
            {/if}
          </div>
        </div>
        <Separator />
        <div class="flex flex-wrap gap-1.5">
          {#if tagsQuery.isLoading}
            <div class="flex w-full flex-wrap gap-1.5">
              <Skeleton class="h-5 w-14 rounded-full" />
              <Skeleton class="h-5 w-18 rounded-full" />
              <Skeleton class="h-5 w-12 rounded-full" />
              <Skeleton class="h-5 w-16 rounded-full" />
            </div>
          {:else if !tagsQuery.data || tagsQuery.data.length === 0}
            <div class="w-full text-xs text-muted-foreground italic">No tags created yet.</div>
          {:else}
            {#each tagsQuery.data as tag, i (tag?._id || i)}
              {#if tag}
                <button
                  onclick={() => {
                    if (selectedTagIds.includes(tag._id)) {
                      selectedTagIds = selectedTagIds.filter((id) => id !== tag._id);
                    } else {
                      selectedTagIds = [...selectedTagIds, tag._id];
                    }
                  }}
                  class="inline-block"
                >
                  <Badge
                    class={cn(
                      'cursor-pointer border text-xs font-normal transition-all duration-200',
                      selectedTagIds.includes(tag._id)
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/95'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    #{tag.name}
                  </Badge>
                </button>
              {/if}
            {/each}
          {/if}
        </div>
      </div>

      <!-- Community Stats -->
      <div class="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
        <h3 class="flex items-center gap-1.5 text-sm font-bold tracking-wider text-muted-foreground uppercase">
          <Calendar class="h-4 w-4" />
          Community Stats
        </h3>
        <Separator />
        <div class="grid grid-cols-2 gap-4 text-center">
          <div class="rounded-lg bg-muted/20 p-2.5">
            <span class="block text-xl font-bold tracking-tight text-primary">
              {postsQuery.data?.length ?? 0}
            </span>
            <span class="text-[10px] font-semibold text-muted-foreground uppercase">Total Posts</span>
          </div>
          <div class="rounded-lg bg-muted/20 p-2.5">
            <span class="block text-xl font-bold tracking-tight text-primary">
              {tagsQuery.data?.length ?? 0}
            </span>
            <span class="text-[10px] font-semibold text-muted-foreground uppercase">Unique Tags</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</PageLayout>

<AlertDialog.Root bind:open={deletePostDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Post</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to delete this post?</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => (postToDeleteId = null)}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={confirmDeletePost} disabled={isDeletingPost}>
        {#if isDeletingPost}
          Deleting...
        {:else}
          Delete
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Manage Tags Dialog -->
<Dialog.Root bind:open={manageTagsDialogOpen}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Tag class="h-5 w-5 text-primary" /> Manage Community Tags
      </Dialog.Title>
      <Dialog.Description>
        Add new tags or edit existing ones. Changes will reflect instantly on all posts.
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="flex items-center gap-2 border-b pb-4">
        <div class="flex-1">
          <Input
            placeholder="new-tag-name"
            bind:value={newTagName}
            class="font-mono text-sm"
            onkeydown={(e) => e.key === 'Enter' && handleCreateTag()}
          />
        </div>
        <Button size="sm" onclick={handleCreateTag} disabled={isCreatingTag}>
          {#if isCreatingTag}
            Adding...
          {:else}
            Add Tag
          {/if}
        </Button>
      </div>

      <div class="max-h-60 space-y-2 overflow-y-auto pr-1">
        <Label class="text-xs font-bold tracking-wider text-muted-foreground uppercase">Active Tags</Label>
        {#if tagsQuery.isLoading}
          <div class="flex flex-wrap gap-1.5">
            <Skeleton class="h-5 w-14 rounded-full" />
            <Skeleton class="h-5 w-16 rounded-full" />
            <Skeleton class="h-5 w-12 rounded-full" />
          </div>
        {:else if !tagsQuery.data || tagsQuery.data.length === 0}
          <div class="text-xs text-muted-foreground italic">No tags created yet.</div>
        {:else}
          {#each tagsQuery.data as tag (tag._id)}
            <div class="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-2 text-xs">
              {#if editingTagId === tag._id}
                <div class="flex flex-1 items-center gap-1.5">
                  <Input
                    bind:value={editingTagName}
                    class="h-7 px-2 py-1 font-mono text-xs"
                    onkeydown={(e) => e.key === 'Enter' && handleUpdateTag(tag._id)}
                  />
                  <Button
                    size="sm"
                    class="h-7 px-2 text-[10px]"
                    onclick={() => handleUpdateTag(tag._id)}
                    disabled={isUpdatingTag}
                  >
                    {#if isUpdatingTag}
                      Saving...
                    {:else}
                      Save
                    {/if}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 px-2 text-[10px] text-muted-foreground"
                    onclick={() => (editingTagId = null)}
                  >
                    Cancel
                  </Button>
                </div>
              {:else}
                <span class="font-mono font-semibold text-foreground">#{tag.name}</span>
                <div class="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 cursor-pointer text-muted-foreground hover:text-foreground"
                    onclick={() => startEditingTag(tag)}
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onclick={() => handleDeleteTag(tag._id)}
                    disabled={isDeletingTag}
                    title="Delete Tag"
                  >
                    {#if isDeletingTag}
                      <Spinner class="h-3 w-3" />
                    {:else}
                      <Trash2 class="h-3.5 w-3.5" />
                    {/if}
                  </Button>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

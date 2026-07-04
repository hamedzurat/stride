<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Check from '@lucide/svelte/icons/check';
  import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Send from '@lucide/svelte/icons/send';
  import Share2 from '@lucide/svelte/icons/share-2';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import DOMPurify from 'isomorphic-dompurify';
  import { toast } from 'svelte-sonner';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { slide } from 'svelte/transition';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import Tiptap from '$lib/components/editor/Tiptap.svelte';
  import { PageLayout } from '$lib/components/page/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';
  import { cn } from '$lib/utils';

  const client = useConvexClient();

  // Reactive URL params
  const postId = $derived(page.params.postId as Id<'posts'>);

  // Queries
  const postQuery = useQuery(api.posts.get, () => ({
    id: postId,
    userId: $session?.userId || undefined,
  }));

  const commentsQuery = useQuery(api.comments.listAllByPost, () => ({
    postId,
    userId: $session?.userId || undefined,
  }));

  // State
  let topCommentContent = $state('');
  let topCommentKey = $state(0);
  let isSubmittingComment = $state(false);

  // Active reply target comment
  let activeReplyCommentId = $state<Id<'comments'> | null>(null);
  let replyContent = $state('');
  let replyCommentKey = $state(0);
  let isSubmittingReply = $state(false);

  // Set of collapsed comment IDs
  let collapsedCommentIds = new SvelteSet<Id<'comments'>>();

  let commentToDeleteId = $state<Id<'comments'> | null>(null);
  let deleteCommentDialogOpen = $state(false);
  let isDeletingComment = $state(false);
  let deletePostDialogOpen = $state(false);
  let isDeletingPost = $state(false);

  // Edit Post state
  let isEditingPost = $state(false);
  let editPostTitle = $state('');
  let editPostContent = $state('');
  let isSavingPost = $state(false);
  let editPostKey = $state(0);

  // Edit Comment state
  let editingCommentId = $state<Id<'comments'> | null>(null);
  let editCommentContent = $state('');
  let isSavingComment = $state(false);
  let editCommentKey = $state(0);

  // Active users in this thread (author + all comment authors)
  const activeUsers = $derived.by(() => {
    if (!postQuery.data) return [];
    const usersMap = new SvelteMap<string, { id: string; name: string; avatar?: string; role?: string }>();

    // Add author
    usersMap.set(postQuery.data.authorId, {
      id: postQuery.data.authorId,
      name: postQuery.data.authorName,
      avatar: postQuery.data.authorAvatar ?? undefined,
      role: postQuery.data.authorRole ?? undefined,
    });

    // Add comment authors
    if (commentsQuery.data) {
      for (const comment of commentsQuery.data) {
        if (!usersMap.has(comment.authorId)) {
          usersMap.set(comment.authorId, {
            id: comment.authorId,
            name: comment.authorName,
            avatar: comment.authorAvatar ?? undefined,
            role: comment.authorRole ?? undefined,
          });
        }
      }
    }

    return Array.from(usersMap.values());
  });

  // Share Post Link
  function sharePost() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  }

  // Post Voting
  async function votePost(value: 1 | -1 | 0) {
    if (!postQuery.data || !$session?.userId) return;

    const currentVote = postQuery.data.userVote;
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

  // Comment Voting
  async function voteComment(commentId: Id<'comments'>, value: 1 | -1 | 0, currentVote: number) {
    if (!$session?.userId) return;
    const nextVoteValue = currentVote === value ? 0 : value;

    try {
      await client.mutation(api.comments.vote, {
        commentId,
        userId: $session.userId,
        value: nextVoteValue,
      });
    } catch (_err) {
      toast.error('Failed to vote.');
    }
  }

  // Add Comment (top level)
  async function submitTopComment(e: Event) {
    e.preventDefault();
    const plainText = topCommentContent.replace(/<[^>]*>/g, '').trim();
    if (!plainText || !$session?.userId) return;

    isSubmittingComment = true;
    try {
      await client.mutation(api.comments.create, {
        authorId: $session.userId,
        postId,
        content: topCommentContent.trim(),
      });
      topCommentContent = '';
      topCommentKey++;
    } catch (_err) {
      toast.error('Failed to add comment.');
    } finally {
      isSubmittingComment = false;
    }
  }

  // Add Reply
  async function submitReply(parentCommentId: Id<'comments'>) {
    const plainText = replyContent.replace(/<[^>]*>/g, '').trim();
    if (!plainText || !$session?.userId) return;

    isSubmittingReply = true;
    try {
      await client.mutation(api.comments.create, {
        authorId: $session.userId,
        postId,
        content: replyContent.trim(),
        parentCommentId,
      });
      replyContent = '';
      replyCommentKey++;
      activeReplyCommentId = null;
    } catch (_err) {
      toast.error('Failed to submit reply.');
    } finally {
      isSubmittingReply = false;
    }
  }

  // Delete Comment
  function deleteComment(commentId: Id<'comments'>) {
    commentToDeleteId = commentId;
    deleteCommentDialogOpen = true;
  }

  async function confirmDeleteComment() {
    if (!commentToDeleteId || isDeletingComment) return;
    isDeletingComment = true;
    try {
      if ($session?.userId) {
        await client.mutation(api.comments.remove, { id: commentToDeleteId, userId: $session.userId });
        toast.success('Comment deleted successfully.');
      }
    } catch (_err) {
      toast.error('Failed to delete comment.');
    } finally {
      commentToDeleteId = null;
      deleteCommentDialogOpen = false;
      isDeletingComment = false;
    }
  }

  // Edit Post Handlers
  function startEditPost() {
    if (!postQuery.data) return;
    editPostTitle = postQuery.data.title;
    editPostContent = postQuery.data.contentMd;
    editPostKey++;
    isEditingPost = true;
  }

  async function savePostEdit() {
    if (!postQuery.data) return;
    if (!editPostTitle.trim()) return toast.error('Post title is required.');
    const plainText = editPostContent.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return toast.error('Post content is required.');

    isSavingPost = true;
    try {
      await client.mutation(api.posts.update, {
        id: postId,
        title: editPostTitle.trim(),
        contentMd: editPostContent.trim(),
      });
      toast.success('Post updated successfully.');
      isEditingPost = false;
    } catch (_err) {
      toast.error('Failed to update post.');
    } finally {
      isSavingPost = false;
    }
  }

  async function confirmDeletePost() {
    if (isDeletingPost) return;
    isDeletingPost = true;
    try {
      await client.mutation(api.posts.remove, { id: postId });
      toast.success('Post deleted successfully.');
      goto('/forum');
    } catch (_err) {
      toast.error('Failed to delete post.');
    } finally {
      deletePostDialogOpen = false;
      isDeletingPost = false;
    }
  }

  // Edit Comment Handlers
  function startEditComment(commentId: Id<'comments'>, currentContent: string) {
    editingCommentId = commentId;
    editCommentContent = currentContent;
    editCommentKey++;
  }

  async function saveCommentEdit(commentId: Id<'comments'>) {
    const plainText = editCommentContent.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return toast.error('Comment content is required.');

    isSavingComment = true;
    try {
      await client.mutation(api.comments.update, {
        id: commentId,
        content: editCommentContent.trim(),
      });
      toast.success('Comment updated successfully.');
      editingCommentId = null;
      editCommentContent = '';
    } catch (_err) {
      toast.error('Failed to update comment.');
    } finally {
      isSavingComment = false;
    }
  }

  // Collapsing thread logic
  function toggleCollapse(commentId: Id<'comments'>) {
    if (collapsedCommentIds.has(commentId)) {
      collapsedCommentIds.delete(commentId);
    } else {
      collapsedCommentIds.add(commentId);
    }
  }

  // Hierarchy builders
  const commentsData = $derived(commentsQuery.data ?? []);

  const topLevelComments = $derived(
    commentsData
      .filter((c) => !c.parentCommentId)
      .sort((a, b) => b.score - a.score || b._creationTime - a._creationTime),
  );

  function getReplies(parentId: Id<'comments'>) {
    return commentsData
      .filter((c) => c.parentCommentId === parentId)
      .sort((a, b) => b.score - a.score || a._creationTime - b._creationTime);
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
</script>

<PageLayout>
  <div class="flex flex-row items-start gap-6">
    <!-- Main Thread & Comments Area -->
    <div class="flex flex-1 flex-col gap-6">
      {#if postQuery.isLoading}
        <Card.Root class="overflow-hidden border bg-card shadow-sm">
          <div class="flex">
            <div class="flex w-14 flex-col items-center justify-start gap-1.5 border-r bg-muted/5 p-4">
              <Skeleton class="h-6 w-6 rounded" />
              <Skeleton class="h-5 w-8" />
              <Skeleton class="h-6 w-6 rounded" />
            </div>
            <Card.Content class="flex flex-1 flex-col gap-4 p-6">
              <div class="flex items-center gap-2.5">
                <Skeleton class="h-6 w-6 rounded-full" />
                <div class="flex flex-col gap-1">
                  <Skeleton class="h-3.5 w-24" />
                  <Skeleton class="h-3 w-16" />
                </div>
              </div>
              <Skeleton class="h-8 w-3/4" />
              <div class="space-y-2">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-5/6" />
                <Skeleton class="h-4 w-4/5" />
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Skeleton class="h-5 w-14 rounded-full" />
                <Skeleton class="h-5 w-18 rounded-full" />
                <Skeleton class="h-5 w-12 rounded-full" />
              </div>
              <Separator />
              <div class="flex items-center gap-4">
                <Skeleton class="h-4 w-24" />
                <Skeleton class="h-4 w-16" />
              </div>
            </Card.Content>
          </div>
        </Card.Root>
      {:else if !postQuery.data}
        <div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <h3 class="text-xl font-bold">Post not found</h3>
          <p class="text-sm text-muted-foreground">The post you are looking for may have been deleted.</p>
          <Button onclick={() => goto('/forum')} size="lg" class="font-semibold shadow-sm">Return to Feed</Button>
        </div>
      {:else}
        {@const post = postQuery.data}
        <!-- Detailed Post Box -->
        <Card.Root class="overflow-hidden border bg-card shadow-sm">
          <div class="flex">
            <!-- Upvote/Downvote side selector -->
            <div class="flex w-14 flex-col items-center justify-start gap-1.5 border-r bg-muted/5 p-4">
              <button
                onclick={() => votePost(1)}
                class={cn(
                  'rounded p-1 transition-colors hover:bg-muted',
                  post.userVote === 1 ? 'text-warning hover:bg-warning/10' : 'text-muted-foreground',
                )}
                aria-label="Upvote post"
              >
                <ArrowUp class="h-6 w-6 font-bold" />
              </button>
              <span
                class={cn(
                  'text-base font-extrabold tracking-tight',
                  post.userVote === 1 && 'text-warning',
                  post.userVote === -1 && 'text-info',
                  post.userVote === 0 && 'text-foreground/80',
                )}
              >
                {post.score ?? 0}
              </span>
              <button
                onclick={() => votePost(-1)}
                class={cn(
                  'rounded p-1 transition-colors hover:bg-muted',
                  post.userVote === -1 ? 'text-info hover:bg-info/10' : 'text-muted-foreground',
                )}
                aria-label="Downvote post"
              >
                <ArrowDown class="h-6 w-6" />
              </button>
            </div>

            <!-- Main Post Content -->
            <Card.Content class="flex flex-1 flex-col gap-4 p-6">
              <!-- Author Header -->
              <div class="flex items-center gap-2.5 text-xs text-muted-foreground">
                <Avatar.Root class="h-6 w-6 border shadow-sm">
                  <Avatar.Image src={post.authorAvatar ?? undefined} />
                  <Avatar.Fallback class="bg-primary/5 text-[10px]">
                    {post.authorName.substring(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div class="flex flex-col">
                  <span class="text-sm leading-none font-bold text-foreground/80">{post.authorName}</span>
                  <span class="mt-0.5 text-[10px]">{formatTime(post._creationTime)}</span>
                </div>
              </div>

              {#if isEditingPost}
                <div class="flex flex-col gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label for="post-title" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                      >Post Title</label
                    >
                    <Input
                      id="post-title"
                      bind:value={editPostTitle}
                      class="bg-muted/10 font-bold"
                      placeholder="Post Title"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label for="post-content" class="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                      >Post Content</label
                    >
                    {#key editPostKey}
                      <Tiptap initialContent={editPostContent} onUpdate={(html: string) => (editPostContent = html)} />
                    {/key}
                  </div>
                  <div class="flex items-center justify-end gap-2">
                    <Button variant="ghost" onclick={() => (isEditingPost = false)} disabled={isSavingPost}>
                      Cancel
                    </Button>
                    <Button
                      onclick={savePostEdit}
                      disabled={isSavingPost ||
                        !editPostTitle.trim() ||
                        !editPostContent.replace(/<[^>]*>/g, '').trim()}
                      class="gap-1 font-semibold"
                    >
                      {#if isSavingPost}
                        <Spinner class="h-4 w-4" /> Saving...
                      {:else}
                        <Check class="h-4 w-4" /> Save Post
                      {/if}
                    </Button>
                  </div>
                </div>
              {:else}
                <!-- Title -->
                <h1 class="text-2xl leading-tight font-black tracking-tight text-foreground">
                  {post.title}
                </h1>

                <!-- Full Description -->
                <div class="prose prose-sm max-w-none leading-relaxed font-normal text-foreground/90 dark:prose-invert">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                  {@html DOMPurify.sanitize(post.contentMd)}
                </div>

                <!-- Full Attached Image -->
                {#if post.imageUrl}
                  <div class="mt-2 overflow-hidden rounded-xl border bg-muted/5">
                    <img src={post.imageUrl} alt={post.title} class="max-h-[500px] w-full object-contain" />
                  </div>
                {/if}
              {/if}

              <!-- Tags -->
              {#if post.tags && post.tags.length > 0}
                <div class="mt-2 flex flex-wrap gap-1.5">
                  {#each post.tags as tag (tag?._id)}
                    {#if tag}
                      <Badge variant="secondary" class="border text-xs font-normal">
                        #{tag.name}
                      </Badge>
                    {/if}
                  {/each}
                </div>
              {/if}

              <Separator />

              <!-- Stats Bar -->
              <div class="flex items-center gap-4 text-xs font-bold text-muted-foreground">
                <div class="flex items-center gap-1">
                  <MessageSquare class="h-4 w-4" />
                  <span>{post.commentCount ?? 0} {post.commentCount === 1 ? 'Comment' : 'Comments'}</span>
                </div>
                <Button variant="ghost" size="sm" onclick={sharePost} class="gap-1">
                  <Share2 class="size-4" />
                  <span>Share</span>
                </Button>
                {#if $session?.userId && (post.authorId === $session.userId || $session.role === 'admin' || $session.role === 'teacher')}
                  <Button variant="ghost" size="sm" onclick={startEditPost} class="gap-1">
                    <Pencil class="size-4" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => (deletePostDialogOpen = true)}
                    class="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 class="size-4" />
                    <span>Delete</span>
                  </Button>
                {/if}
              </div>
            </Card.Content>
          </div>
        </Card.Root>

        <!-- Comment Section -->
        <div class="flex flex-col gap-6">
          <h3 class="flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground">
            Comments ({commentsQuery.isLoading ? '...' : commentsData.length})
          </h3>

          <!-- Add Top-Level Comment Form -->
          {#if $session?.userId}
            <form onsubmit={submitTopComment} class="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
              {#key topCommentKey}
                <Tiptap initialContent={topCommentContent} onUpdate={(html: string) => (topCommentContent = html)} />
              {/key}
              <div class="flex items-center justify-end">
                <Button
                  type="submit"
                  disabled={isSubmittingComment || !topCommentContent.replace(/<[^>]*>/g, '').trim()}
                  size="sm"
                  class="gap-1.5 font-semibold shadow-sm"
                >
                  {#if isSubmittingComment}
                    <Spinner class="h-3.5 w-3.5" /> Posting...
                  {:else}
                    <Send class="h-3.5 w-3.5" /> Post Comment
                  {/if}
                </Button>
              </div>
            </form>
          {:else}
            <div class="rounded-xl border border-dashed bg-muted/15 p-6 text-center text-sm text-muted-foreground">
              Please <button onclick={() => goto('/login')} class="font-bold text-primary hover:underline"
                >log in</button
              > to post comments.
            </div>
          {/if}

          <!-- Recursive Comments Tree Loader -->
          <div class="flex flex-col gap-4">
            {#if commentsQuery.isLoading}
              <div class="flex flex-col gap-4 p-4">
                {#each [1, 2, 3] as i (i)}
                  <div class="flex items-start gap-3">
                    <Skeleton class="h-8 w-8 rounded-full" />
                    <div class="flex-1 space-y-2">
                      <Skeleton class="h-4 w-24" />
                      <Skeleton class="h-4 w-full" />
                      <Skeleton class="h-4 w-3/4" />
                      <Skeleton class="h-4 w-2/3" />
                    </div>
                  </div>
                {/each}
              </div>
            {:else if topLevelComments.length === 0}
              <div
                class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-10 text-center"
              >
                <Sparkles class="h-8 w-8 text-muted-foreground opacity-30" />
                <p class="text-sm text-muted-foreground italic">No comments yet. Start the conversation!</p>
              </div>
            {:else}
              <!-- Svelte 5 Recursive Snippet Definition -->
              {#snippet renderComment(comment: (typeof commentsData)[number], depth: number)}
                {@const isCollapsed = collapsedCommentIds.has(comment._id)}
                {@const replies = getReplies(comment._id)}

                <div class="relative mt-4 flex flex-col gap-2" transition:slide={{ duration: 150 }}>
                  <div class="flex items-start gap-2">
                    <!-- Vote Panel (small, vertical) -->
                    <div
                      class="flex w-9 flex-col items-center justify-start gap-1 rounded-lg border bg-muted/5 p-1 text-[10px]"
                    >
                      {#if !comment.isDeleted}
                        <button
                          onclick={() => voteComment(comment._id, 1, comment.userVote)}
                          class={cn(
                            'rounded p-0.5 transition-colors hover:bg-muted',
                            comment.userVote === 1 ? 'text-warning' : 'text-muted-foreground',
                          )}
                          aria-label="Upvote comment"
                        >
                          <ArrowUp class="h-3.5 w-3.5" />
                        </button>
                      {/if}
                      <span
                        class={cn(
                          'font-bold',
                          comment.userVote === 1 && 'text-warning',
                          comment.userVote === -1 && 'text-info',
                          comment.userVote === 0 && 'text-foreground/70',
                        )}
                      >
                        {comment.score ?? 0}
                      </span>
                      {#if !comment.isDeleted}
                        <button
                          onclick={() => voteComment(comment._id, -1, comment.userVote)}
                          class={cn(
                            'rounded p-0.5 transition-colors hover:bg-muted',
                            comment.userVote === -1 ? 'text-info' : 'text-muted-foreground',
                          )}
                          aria-label="Downvote comment"
                        >
                          <ArrowDown class="h-3.5 w-3.5" />
                        </button>
                      {/if}
                    </div>

                    <!-- Comment Body Area -->
                    <div class="flex flex-1 flex-col gap-2">
                      <!-- Comment Meta Header -->
                      <div class="flex items-center justify-between text-[11px] text-muted-foreground">
                        <div class="flex items-center gap-2">
                          <Avatar.Root class="h-5 w-5 shrink-0 border shadow-sm">
                            <Avatar.Image src={comment.authorAvatar ?? undefined} />
                            <Avatar.Fallback class="bg-primary/5 text-[8px]">
                              {comment.authorName.substring(0, 2).toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                          <span class="font-bold text-foreground/80">{comment.authorName}</span>
                          <span>•</span>
                          <span>{formatTime(comment._creationTime)}</span>
                        </div>

                        <button
                          onclick={() => toggleCollapse(comment._id)}
                          class="rounded bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground"
                        >
                          {isCollapsed ? `[+] Expand (${replies.length})` : '[-] Collapse'}
                        </button>
                      </div>

                      {#if !isCollapsed}
                        {#if editingCommentId === comment._id}
                          <!-- Comment Editing Form -->
                          <div class="mt-2 flex flex-col gap-2 pl-1">
                            {#key editCommentKey}
                              <Tiptap
                                initialContent={editCommentContent}
                                onUpdate={(html: string) => (editCommentContent = html)}
                              />
                            {/key}
                            <div class="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => {
                                  editingCommentId = null;
                                  editCommentContent = '';
                                }}
                                disabled={isSavingComment}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onclick={() => saveCommentEdit(comment._id)}
                                disabled={isSavingComment || !editCommentContent.replace(/<[^>]*>/g, '').trim()}
                                class="font-semibold"
                              >
                                {#if isSavingComment}
                                  <Spinner class="size-3" /> Saving...
                                {:else}
                                  <Check class="size-3" /> Save
                                {/if}
                              </Button>
                            </div>
                          </div>
                        {:else}
                          <!-- Content body -->
                          <div
                            class="prose prose-sm max-w-none pl-1 text-sm leading-relaxed font-normal text-foreground/90 dark:prose-invert"
                          >
                            {#if comment.isDeleted}
                              <p class="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                                [This comment has been deleted by {comment.deletedBy === 'moderator'
                                  ? 'moderator'
                                  : 'user'}]
                              </p>
                            {:else}
                              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                              {@html DOMPurify.sanitize(comment.content)}
                            {/if}
                          </div>

                          <!-- Footer Controls -->
                          {#if !comment.isDeleted}
                            <div class="flex items-center gap-3 text-[11px] font-bold text-muted-foreground">
                              {#if $session?.userId}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onclick={() => {
                                    if (activeReplyCommentId === comment._id) {
                                      activeReplyCommentId = null;
                                      replyContent = '';
                                    } else {
                                      activeReplyCommentId = comment._id;
                                      replyContent = '';
                                    }
                                  }}
                                  class="gap-1"
                                >
                                  <CornerDownRight class="size-3.5" />
                                  Reply
                                </Button>
                              {/if}

                              <!-- Edit Option -->
                              {#if $session?.userId && (comment.authorId === $session.userId || $session.role === 'admin' || $session.role === 'teacher')}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onclick={() => startEditComment(comment._id, comment.content)}
                                  class="gap-1"
                                >
                                  <Pencil class="size-3.5" />
                                  Edit
                                </Button>
                              {/if}

                              <!-- Delete Option -->
                              {#if $session?.userId && (comment.authorId === $session.userId || $session.role === 'admin' || $session.role === 'teacher')}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onclick={() => deleteComment(comment._id)}
                                  class="gap-1 text-destructive hover:text-destructive"
                                >
                                  <Trash2 class="size-3.5" />
                                  Delete
                                </Button>
                              {/if}
                            </div>
                          {/if}
                        {/if}

                        <!-- Inline Reply Input Form -->
                        {#if activeReplyCommentId === comment._id}
                          <div class="mt-2 flex flex-col gap-2 border-l-2 border-primary/20 pl-3" transition:slide>
                            {#key replyCommentKey}
                              <Tiptap
                                initialContent={replyContent}
                                onUpdate={(html: string) => (replyContent = html)}
                              />
                            {/key}
                            <div class="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => {
                                  activeReplyCommentId = null;
                                  replyContent = '';
                                }}
                                disabled={isSubmittingReply}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onclick={() => submitReply(comment._id)}
                                disabled={isSubmittingReply || !replyContent.replace(/<[^>]*>/g, '').trim()}
                                class="font-semibold"
                              >
                                {#if isSubmittingReply}
                                  <Spinner class="size-3" /> Replying...
                                {:else}
                                  <Send class="size-3" /> Reply
                                {/if}
                              </Button>
                            </div>
                          </div>
                        {/if}
                      {/if}
                    </div>
                  </div>

                  <!-- Sub-Replies (Indented with Guide Lines) -->
                  {#if !isCollapsed && replies.length > 0}
                    <div
                      class="relative ml-3 flex flex-col gap-2 border-l border-border/60 pl-5 transition-all duration-200 hover:border-primary/30"
                    >
                      {#each replies as reply (reply._id)}
                        {@render renderComment(reply, depth + 1)}
                      {/each}
                    </div>
                  {/if}
                </div>
              {/snippet}

              <!-- Render Top Level Comments -->
              {#each topLevelComments as comment (comment._id)}
                {@render renderComment(comment, 0)}
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <!-- Sidebar Column -->
    <div class="hidden w-80 shrink-0 flex-col gap-6 lg:flex">
      {#if postQuery.data}
        <!-- Active Thread Users Card -->
        <div class="sticky top-22 flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm">
          <h3 class="flex items-center gap-1.5 text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Active Users
          </h3>
          <Separator />
          <div class="flex flex-col gap-2">
            {#each activeUsers as activeUser (activeUser.id)}
              <button
                onclick={() => goto(`/users/${activeUser.id}`)}
                class="group flex w-full items-center gap-3 rounded-lg p-1 text-left transition-all hover:bg-muted/40"
              >
                <Avatar.Root class="h-8 w-8 border shadow-sm">
                  <Avatar.Image src={activeUser.avatar} />
                  <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                    {activeUser.name.substring(0, 2).toUpperCase()}
                  </Avatar.Fallback>
                </Avatar.Root>
                <div class="flex flex-col overflow-hidden">
                  <span
                    class="truncate text-xs font-extrabold text-foreground transition-colors group-hover:text-primary"
                  >
                    {activeUser.name}
                  </span>
                  <span class="truncate text-[9px] text-muted-foreground capitalize">
                    {activeUser.role}
                  </span>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</PageLayout>

<AlertDialog.Root bind:open={deleteCommentDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Comment</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to delete this comment?</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => (commentToDeleteId = null)}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={confirmDeleteComment} disabled={isDeletingComment}>
        {#if isDeletingComment}
          Deleting...
        {:else}
          Delete
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={deletePostDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Post</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete this post? This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
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

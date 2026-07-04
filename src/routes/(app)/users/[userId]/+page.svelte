<script lang="ts">
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Award from '@lucide/svelte/icons/award';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Calendar from '@lucide/svelte/icons/calendar';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import PenTool from '@lucide/svelte/icons/pen-tool';
  import Settings from '@lucide/svelte/icons/settings';
  import Shield from '@lucide/svelte/icons/shield';
  import Signature from '@lucide/svelte/icons/signature';
  import User from '@lucide/svelte/icons/user';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import DOMPurify from 'isomorphic-dompurify';
  import { toast } from 'svelte-sonner';
  import { fade } from 'svelte/transition';

  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import { PageLayout } from '$lib/components/page/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';
  import { cn } from '$lib/utils';

  const client = useConvexClient();

  // Extract dynamic route param
  const userId = $derived(page.params.userId as Id<'users'>);

  // Fetch full user public profile details
  const profileQuery = useQuery(api.users.getProfileData, () => ({ userId }));

  // Tab state
  let activeTab = $state<'about' | 'sections' | 'posts' | 'comments'>('about');
  let isStartingChat = $state(false);

  async function startDirectChat() {
    if (!$session?.userId || !profileQuery.data?.user._id) return;
    isStartingChat = true;
    try {
      const chatId = await client.mutation(api.chats.getOrCreateDirectChat, {
        userA: $session.userId,
        userB: profileQuery.data.user._id,
      });
      goto(`/chat?chatId=${chatId}`);
    } catch (_err) {
      toast.error('Failed to start conversation.');
    } finally {
      isStartingChat = false;
    }
  }

  // Human-friendly date formatting
  function formatJoinedDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function formatTime(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function nameGradient(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue1 = ((hash % 360) + 360) % 360;
    const hue2 = (((hue1 + 40) % 360) + 360) % 360;
    return `linear-gradient(135deg, hsl(${hue1} 70% 50%), hsl(${hue2} 70% 50%))`;
  }
</script>

<PageLayout>
  {#if profileQuery.isLoading}
    <div class="flex flex-col gap-8">
      <div class="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div class="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <Skeleton class="h-24 w-24 shrink-0 rounded-full md:h-28 md:w-28" />
          <div class="flex flex-col items-center gap-3 md:items-start">
            <Skeleton class="h-8 w-48 md:h-9 md:w-56" />
            <Skeleton class="h-4 w-32" />
            <div class="flex flex-wrap justify-center gap-x-4 gap-y-1.5 md:justify-start">
              <Skeleton class="h-4 w-36" />
              <Skeleton class="h-4 w-28" />
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {#each Array(4) as _, i (i)}
          <Card.Root class="border border-border bg-card">
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton class="h-4 w-24" />
              <Skeleton class="h-4 w-4 rounded-full" />
            </Card.Header>
            <Card.Content>
              <Skeleton class="h-8 w-16" />
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
      <div class="flex flex-col gap-6">
        <div class="flex border-b">
          <div class="px-5 py-3"><Skeleton class="h-4 w-20" /></div>
          <div class="px-5 py-3"><Skeleton class="h-4 w-24" /></div>
          <div class="px-5 py-3"><Skeleton class="h-4 w-28" /></div>
          <div class="px-5 py-3"><Skeleton class="h-4 w-32" /></div>
        </div>
        <div class="space-y-3">
          {#each [1, 2, 3] as i (i)}
            <Skeleton class="h-16 w-full rounded-lg" />
          {/each}
        </div>
      </div>
    </div>
  {:else if !profileQuery.data}
    <div class="flex h-96 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-8 text-center">
      <div class="rounded-full bg-muted p-4">
        <Shield class="h-12 w-12 text-muted-foreground opacity-40" />
      </div>
      <h2 class="text-xl font-bold">User Not Found</h2>
      <p class="max-w-xs text-sm text-muted-foreground">
        The user profile you are trying to access does not exist or has been removed from Stride.
      </p>
      <Button size="sm" onclick={() => goto('/dashboard')} class="mt-2">Return to Dashboard</Button>
    </div>
  {:else}
    {@const profile = profileQuery.data}
    <div class="flex flex-col gap-8">
      <!-- 1. PREMIUM HEADER GLASS BANNER -->
      <div class="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <!-- Visual blur background decoration -->
        <div class="absolute -top-16 -right-16 -z-10 h-44 w-44 rounded-full bg-primary/10 blur-3xl"></div>

        <div
          class="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:justify-between md:text-left"
        >
          <!-- Left side: Avatar & Info -->
          <div class="flex flex-col items-center gap-5 md:flex-row md:items-center">
            <!-- Large High-Res Avatar -->
            <div
              class="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 shadow-sm md:h-28 md:w-28 {profile
                .user.role === 'admin'
                ? 'border-destructive/60'
                : profile.user.role === 'teacher'
                  ? 'border-primary/60'
                  : 'border-success/60'}"
              style={!profile.user.avatarUrl ? `background: ${nameGradient(profile.user.name)}` : ''}
            >
              {#if profile.user.avatarUrl}
                <img src={profile.user.avatarUrl} alt={profile.user.name} class="h-full w-full object-cover" />
              {:else}
                <span class="text-3xl font-extrabold tracking-tight text-white uppercase drop-shadow-sm md:text-4xl">
                  {profile.user.name.substring(0, 2)}
                </span>
              {/if}
            </div>

            <!-- Details -->
            <div class="space-y-2.5">
              <div class="flex flex-col items-center gap-2 md:flex-row md:items-center md:gap-3">
                <h1 class="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                  {profile.user.name}
                </h1>
                <Badge
                  class="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-sm"
                  variant={profile.user.role === 'admin'
                    ? 'destructive'
                    : profile.user.role === 'teacher'
                      ? 'outline'
                      : 'default'}
                >
                  {profile.user.role}
                </Badge>
              </div>

              <!-- Extra Meta Info -->
              <div
                class="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground md:justify-start"
              >
                <span class="flex items-center gap-1.5">
                  <User class="h-4 w-4" />
                  {profile.user.email}
                </span>
                <span class="hidden md:inline">•</span>
                <span class="flex items-center gap-1.5">
                  <Calendar class="h-4 w-4" />
                  {formatJoinedDate(profile.user._creationTime)}
                </span>
              </div>
            </div>
          </div>

          <!-- Right side: Actions -->
          <div class="flex shrink-0 items-center gap-2">
            {#if $session?.userId === profile.user._id}
              <Button variant="outline" size="sm" onclick={() => goto('/settings')} class="gap-1.5 font-semibold">
                <Settings class="h-4 w-4 text-muted-foreground" />
                Edit Profile
              </Button>
            {:else if $session?.userId}
              <Button
                variant="default"
                size="sm"
                onclick={startDirectChat}
                disabled={isStartingChat}
                class="gap-1.5 font-semibold shadow-xs"
              >
                {#if isStartingChat}
                  <Spinner class="size-4" />
                  Connecting...
                {:else}
                  <MessageSquare class="h-4 w-4" />
                  Message
                {/if}
              </Button>
            {/if}
          </div>
        </div>
      </div>

      <!-- 2. QUICK STATISTICS COUNTERS -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <!-- Forum Posts -->
        <Card.Root class="border transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Forum Posts</Card.Title>
            <div class="rounded-full bg-indigo-500/10 p-1.5 text-indigo-500"><PenTool class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{profile.posts.length}</div>
          </Card.Content>
        </Card.Root>

        <!-- Comments -->
        <Card.Root class="border transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Comments Written</Card.Title>
            <div class="rounded-full bg-amber-500/10 p-1.5 text-amber-500"><MessageSquare class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{profile.comments.length}</div>
          </Card.Content>
        </Card.Root>

        <!-- Sections Count -->
        <Card.Root class="border transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">
              {profile.user.role === 'teacher' ? 'Sections Taught' : 'Sections Enrolled'}
            </Card.Title>
            <div class="rounded-full bg-emerald-500/10 p-1.5 text-emerald-500"><BookOpen class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{profile.sections.length}</div>
          </Card.Content>
        </Card.Root>

        <!-- Code Submissions -->
        <Card.Root class="border transition-all duration-200 hover:border-primary/30 hover:shadow-sm">
          <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
            <Card.Title class="text-xs font-bold text-muted-foreground uppercase">Submissions</Card.Title>
            <div class="rounded-full bg-rose-500/10 p-1.5 text-rose-500"><Award class="h-4 w-4" /></div>
          </Card.Header>
          <Card.Content>
            <div class="text-2xl font-bold text-foreground">{profile.submissionsCount}</div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- 3. DETAILED VIEW TABS -->
      <div class="flex flex-col gap-6">
        <!-- Tab selector headers -->
        <div class="flex border-b" role="tablist">
          <button
            onclick={() => (activeTab = 'about')}
            role="tab"
            aria-selected={activeTab === 'about'}
            class={cn(
              'border-b-2 px-5 py-3 text-sm font-bold tracking-tight transition-all duration-200 focus:outline-none',
              activeTab === 'about'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground',
            )}
          >
            Biography
          </button>
          <button
            onclick={() => (activeTab = 'sections')}
            role="tab"
            aria-selected={activeTab === 'sections'}
            class={cn(
              'border-b-2 px-5 py-3 text-sm font-bold tracking-tight transition-all duration-200 focus:outline-none',
              activeTab === 'sections'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground',
            )}
          >
            Sections ({profile.sections.length})
          </button>
          <button
            onclick={() => (activeTab = 'posts')}
            role="tab"
            aria-selected={activeTab === 'posts'}
            class={cn(
              'border-b-2 px-5 py-3 text-sm font-bold tracking-tight transition-all duration-200 focus:outline-none',
              activeTab === 'posts'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground',
            )}
          >
            Recent Posts ({profile.posts.length})
          </button>
          <button
            onclick={() => (activeTab = 'comments')}
            role="tab"
            aria-selected={activeTab === 'comments'}
            class={cn(
              'border-b-2 px-5 py-3 text-sm font-bold tracking-tight transition-all duration-200 focus:outline-none',
              activeTab === 'comments'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground',
            )}
          >
            Recent Comments ({profile.comments.length})
          </button>
        </div>

        <!-- TAB CONTENT PORTAL -->
        <div class="min-h-72">
          <!-- A. BIOGRAPHY TAB -->
          {#if activeTab === 'about'}
            <div in:fade={{ duration: 150 }}>
              {#if profile.user.aboutMd && profile.user.aboutMd.trim() !== '<p></p>' && profile.user.aboutMd.trim() !== ''}
                <Card.Root class="border bg-card shadow-xs">
                  <Card.Content class="p-6 md:p-8">
                    <article class="prose max-w-none leading-relaxed text-foreground/90 prose-zinc dark:prose-invert">
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html DOMPurify.sanitize(profile.user.aboutMd)}
                    </article>
                  </Card.Content>
                </Card.Root>
              {:else}
                <div
                  class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center"
                >
                  <div class="rounded-full bg-muted p-4">
                    <Signature class="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                  <h3 class="text-lg font-bold">No Biography Written</h3>
                  <p class="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    This user hasn't added a personal introduction, achievements, or coding bio to Stride yet.
                  </p>
                  {#if $session?.userId === profile.user._id}
                    <Button size="sm" onclick={() => goto('/settings')} class="mt-2">Write Bio in Settings</Button>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- SECTIONS TAB -->
          {:else if activeTab === 'sections'}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              {#if profile.sections.length === 0}
                <div
                  class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center"
                >
                  <div class="rounded-full bg-muted p-4">
                    <BookOpen class="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                  <h3 class="text-lg font-bold">No Sections</h3>
                  <p class="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    This user is not enrolled in or teaching any sections.
                  </p>
                </div>
              {:else}
                <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {#each profile.sections as s (s._id)}
                    <button onclick={() => goto(`/sections/${s._id}`)} class="w-full text-left focus:outline-none">
                      <Card.Root class="group flex h-full cursor-pointer flex-col gap-3 border border-border bg-card">
                        <Card.Content class="flex flex-col gap-3 p-5">
                          <div class="flex shrink-0 items-start gap-3">
                            <div class="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                              <BookOpen class="h-5 w-5" />
                            </div>
                            <div class="min-w-0 flex-1 space-y-0.5">
                              <h4 class="line-clamp-2 text-sm leading-snug font-bold text-foreground">
                                {s.name}
                              </h4>
                              <p class="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                <User class="h-3.5 w-3.5 text-muted-foreground/80" />
                                Instructor: {s.teacherName}
                              </p>
                            </div>
                          </div>
                          {#if s.aboutMd && s.aboutMd.trim() !== ''}
                            <Separator class="my-0.5 opacity-60" />
                            <div
                              class="prose line-clamp-3 max-w-none text-xs leading-relaxed text-muted-foreground/80 prose-zinc dark:prose-invert"
                            >
                              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                              {@html DOMPurify.sanitize(s.aboutMd)}
                            </div>
                          {/if}
                        </Card.Content>
                      </Card.Root>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- B. FORUM POSTS TAB -->
          {:else if activeTab === 'posts'}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              {#if profile.posts.length === 0}
                <div
                  class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center"
                >
                  <div class="rounded-full bg-muted p-4">
                    <PenTool class="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                  <h3 class="text-lg font-bold">No Posts Created</h3>
                  <p class="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    This user hasn't created any discussion threads or questions in the Stride forum yet.
                  </p>
                </div>
              {:else}
                {#each profile.posts as post (post._id)}
                  <Card.Root
                    class="group cursor-pointer border-border transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                    onclick={() => goto(`/forum/${post._id}`)}
                  >
                    <Card.Content class="flex flex-col gap-2.5 p-5">
                      <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <span class="rounded bg-muted/30 px-2 py-0.5 font-medium">Forum Post</span>
                        <span>{formatTime(post._creationTime ?? Date.now())}</span>
                      </div>

                      <h3
                        class="text-base leading-snug font-bold text-foreground transition-colors group-hover:text-primary"
                      >
                        {post.title}
                      </h3>

                      <!-- Text Preview -->
                      <p class="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {(post.contentMd || '').replace(/<[^>]*>/g, '')}
                      </p>

                      <!-- Tags -->
                      {#if post.tags && post.tags.length > 0}
                        <div class="flex flex-wrap gap-1 pt-1">
                          {#each post.tags as tag (tag._id)}
                            <Badge variant="secondary" class="border bg-muted/20 px-2 py-0 text-[9px] font-normal">
                              #{tag.name}
                            </Badge>
                          {/each}
                        </div>
                      {/if}

                      <Separator class="my-1.5" />

                      <div class="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                        <!-- Reddit style score and comments under the message -->
                        <div class="flex items-center gap-3">
                          <!-- Reddit score -->
                          <div
                            class="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 transition-colors hover:bg-muted/60"
                          >
                            <ArrowUp class="h-3.5 w-3.5 text-muted-foreground" />
                            <span class="px-0.5 font-bold text-foreground/80">{post.score ?? 0}</span>
                            <ArrowDown class="h-3.5 w-3.5 text-muted-foreground" />
                          </div>

                          <!-- Comments count -->
                          <div
                            class="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 transition-colors hover:bg-muted/60"
                          >
                            <MessageSquare class="h-3.5 w-3.5" />
                            <span>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>
                          </div>
                        </div>

                        <span
                          class="flex items-center gap-0.5 text-primary/80 transition-all duration-200 group-hover:text-primary"
                        >
                          Read Post
                          <ChevronRight class="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Card.Content>
                  </Card.Root>
                {/each}
              {/if}
            </div>

            <!-- C. RECENT COMMENTS TAB -->
          {:else if activeTab === 'comments'}
            <div class="flex flex-col gap-4" in:fade={{ duration: 150 }}>
              {#if profile.comments.length === 0}
                <div
                  class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center"
                >
                  <div class="rounded-full bg-muted p-4">
                    <MessageSquare class="h-8 w-8 text-muted-foreground opacity-40" />
                  </div>
                  <h3 class="text-lg font-bold">No Comments Written</h3>
                  <p class="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    This user hasn't participated in any comments or feedback in forum discussion threads yet.
                  </p>
                </div>
              {:else}
                {#each profile.comments as comment (comment._id)}
                  <Card.Root
                    class="group cursor-pointer border-border transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                    onclick={() => goto(`/forum/${comment.postId}`)}
                  >
                    <Card.Content class="flex flex-col gap-2.5 p-5">
                      <!-- Comment Header -->
                      <div class="flex items-center justify-between text-xs leading-none text-muted-foreground">
                        <div class="flex items-center gap-1.5">
                          <Award class="h-3.5 w-3.5 text-muted-foreground" />
                          <span class="font-medium text-foreground/80">
                            Commented on <span class="font-bold text-primary hover:underline">{comment.postTitle}</span>
                          </span>
                        </div>
                        <span>{formatTime(comment.createdAt)}</span>
                      </div>

                      <!-- Comment Body Snippet -->
                      <div
                        class="prose prose-sm line-clamp-3 max-w-none py-1 leading-relaxed text-foreground/90 dark:prose-invert"
                      >
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html DOMPurify.sanitize(comment.content)}
                      </div>

                      <Separator class="my-1.5" />

                      <!-- Comment Footer Stats -->
                      <div class="mt-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                        <!-- Reddit style score under the comment -->
                        <div
                          class="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 transition-colors hover:bg-muted/60"
                        >
                          <ArrowUp class="h-3.5 w-3.5 text-muted-foreground" />
                          <span class="px-0.5 font-bold text-foreground/80">{comment.score ?? 0}</span>
                          <ArrowDown class="h-3.5 w-3.5 text-muted-foreground" />
                        </div>

                        <span
                          class="flex items-center gap-0.5 text-primary/80 transition-all duration-200 group-hover:text-primary"
                        >
                          View Comment Location
                          <ChevronRight class="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Card.Content>
                  </Card.Root>
                {/each}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</PageLayout>

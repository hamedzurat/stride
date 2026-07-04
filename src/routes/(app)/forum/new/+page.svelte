<script lang="ts">
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { toast } from 'svelte-sonner';
  import { slide } from 'svelte/transition';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import Tiptap from '$lib/components/editor/Tiptap.svelte';
  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();

  // Queries
  const tagsQuery = useQuery(api.posts.listTags, () => ({}));

  // Form State
  let title = $state('');
  let contentMd = $state('');
  let isSubmitting = $state(false);

  // Tags State
  let selectedTagIds = $state<Id<'tags'>[]>([]);
  let newTagName = $state('');
  let showAddTagInput = $state(false);

  // Tags selection
  function toggleTag(tagId: Id<'tags'>) {
    if (selectedTagIds.includes(tagId)) {
      selectedTagIds = selectedTagIds.filter((id) => id !== tagId);
    } else {
      selectedTagIds = [...selectedTagIds, tagId];
    }
  }

  // Create Tag Mutator
  async function createCustomTag() {
    if (!newTagName.trim()) return;
    const name = newTagName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (!name) return;

    try {
      const tagId = await client.mutation(api.posts.createTag, { name });
      if (!selectedTagIds.includes(tagId)) {
        selectedTagIds = [...selectedTagIds, tagId];
      }
      newTagName = '';
      showAddTagInput = false;
    } catch (_err) {
      toast.error('Failed to create tag.');
    }
  }

  async function submitPost(e: Event) {
    e.preventDefault();
    if (!title.trim()) return toast.error('Post title is required.');
    const plainText = contentMd.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return toast.error('Post content is required.');
    if (!$session?.userId) return;

    isSubmitting = true;

    try {
      const postId = await client.mutation(api.posts.create, {
        authorId: $session.userId,
        title: title.trim(),
        contentMd: contentMd.trim(),
        tagIds: selectedTagIds,
      });

      toast.success('Post created successfully.');
      goto(`/forum/${postId}`);
    } catch (_err) {
      toast.error('Failed to create post. Please try again.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<PageLayout>
  <PageHero title="Create a New Post" description="Share questions, codes, or guides. Be respectful of others." />

  <Card.Root class="border bg-card shadow-md">
    <Card.Content class="p-6">
      <form onsubmit={submitPost} class="flex flex-col gap-6">
        <!-- Title Input -->
        <div class="flex flex-col gap-2">
          <Label for="post-title" class="text-sm font-semibold">Title</Label>
          <Input
            id="post-title"
            placeholder="An interesting title about your question or project"
            bind:value={title}
            maxlength={100}
            required
            class="border-primary/20 py-5 text-base focus-visible:ring-primary/30"
          />
          <div class="text-right text-[10px] text-muted-foreground">{title.length}/100</div>
        </div>

        <!-- Post Content -->
        <div class="flex flex-col gap-2">
          <Label for="post-body" class="text-sm font-semibold">Post Content</Label>
          <Tiptap initialContent={contentMd} onUpdate={(html: string) => (contentMd = html)} />
        </div>

        <!-- Tags Selection & Creation -->
        <div class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold">Select relavent tags</h3>
          <!-- Add custom tag slide down -->
          {#if showAddTagInput}
            <div class="flex gap-2" transition:slide={{ duration: 150 }}>
              <Input
                placeholder="tagname (e.g. recursion)"
                bind:value={newTagName}
                maxlength={20}
                onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), createCustomTag())}
                class="h-9 border-primary/20 text-sm"
              />
              <Button type="button" size="sm" onclick={createCustomTag} class="h-9">Add</Button>
            </div>
          {/if}

          <!-- Tags list selection -->
          <div class="flex flex-wrap gap-1.5 rounded-lg border bg-muted/5 p-2.5">
            {#if tagsQuery.isLoading}
              <div class="flex flex-wrap gap-1.5">
                <Skeleton class="h-5 w-14 rounded-full" />
                <Skeleton class="h-5 w-16 rounded-full" />
                <Skeleton class="h-5 w-12 rounded-full" />
              </div>
            {:else if !tagsQuery.data || tagsQuery.data.length === 0}
              <span class="text-xs text-muted-foreground italic">No tags. Create a new tag!</span>
            {:else}
              {#each tagsQuery.data as tag (tag?._id)}
                {#if tag}
                  <button type="button" onclick={() => toggleTag(tag._id)} class="inline-block text-left">
                    <Badge
                      class={`cursor-pointer border text-xs font-normal transition-all ${selectedTagIds.includes(tag._id) ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/95' : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    >
                      #{tag.name}
                    </Badge>
                  </button>
                {/if}
              {/each}
            {/if}
          </div>
        </div>

        <Separator class="my-2" />

        <!-- Form Actions -->
        <div class="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onclick={() => goto('/forum')} disabled={isSubmitting}>Cancel</Button>
          <Button
            type="submit"
            disabled={isSubmitting || !title.trim() || !contentMd.trim()}
            class="min-w-32 gap-1.5 font-semibold shadow-sm"
          >
            {#if isSubmitting}
              <Spinner class="size-4" /> Creating...
            {:else}
              Publish Post
            {/if}
          </Button>
        </div>
      </form>
    </Card.Content>
  </Card.Root>
</PageLayout>

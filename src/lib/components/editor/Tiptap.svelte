<script lang="ts">
  import Bold from '@lucide/svelte/icons/bold';
  import Code from '@lucide/svelte/icons/code';
  import Heading1 from '@lucide/svelte/icons/heading-1';
  import Heading2 from '@lucide/svelte/icons/heading-2';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Italic from '@lucide/svelte/icons/italic';
  import LinkIcon from '@lucide/svelte/icons/link';
  import List from '@lucide/svelte/icons/list';
  import ListOrdered from '@lucide/svelte/icons/list-ordered';
  import Loader2 from '@lucide/svelte/icons/loader-2';
  import Quote from '@lucide/svelte/icons/quote';
  import Redo from '@lucide/svelte/icons/redo';
  import Sigma from '@lucide/svelte/icons/sigma';
  import SquareCode from '@lucide/svelte/icons/square-code';
  import Strikethrough from '@lucide/svelte/icons/strikethrough';
  import Undo from '@lucide/svelte/icons/undo';
  import UploadCloud from '@lucide/svelte/icons/upload-cloud';
  import { Editor } from '@tiptap/core';
  import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
  import Image from '@tiptap/extension-image';
  import Link from '@tiptap/extension-link';
  import { Mathematics } from '@tiptap/extension-mathematics';
  import StarterKit from '@tiptap/starter-kit';
  import { useConvexClient } from 'convex-svelte';
  import { common, createLowlight } from 'lowlight';
  import { onDestroy, onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { Separator } from '$lib/components/ui/separator';
  import { session } from '$lib/session';

  let { initialContent = '', onUpdate } = $props();

  let element: HTMLElement;
  let editor = $state.raw<Editor>();
  let tick = $state(0);

  const lowlight = createLowlight(common);

  function checkActive(type: string, options?: Record<string, unknown>) {
    void tick;
    return editor?.isActive(type, options);
  }

  function canUndo() {
    void tick;
    return editor?.can().undo();
  }

  function canRedo() {
    void tick;
    return editor?.can().redo();
  }

  const client = useConvexClient();

  let isImagePopoverOpen = $state(false);
  let imageTab = $state<'upload' | 'url'>('upload');
  let isUploadingImage = $state(false);
  let imageUrlInput = $state('');
  let uploadedStorageIds = $state<string[]>([]);

  function insertImageUrl() {
    if (imageUrlInput.trim()) {
      editor?.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
      imageUrlInput = '';
      isImagePopoverOpen = false;
    }
  }

  async function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    isUploadingImage = true;

    try {
      const uploadUrl = await client.mutation(api.uploadedImages.generateUploadUrl, {});
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) throw new Error('HTTP upload failed');

      const result = await response.json();
      const storageId = result.storageId as string;

      if ($session?.userId) {
        await client.mutation(api.uploadedImages.registerUploadedImage, {
          storageId: storageId as Id<'_storage'>,
          authorId: $session.userId,
        });
        uploadedStorageIds = [...uploadedStorageIds, storageId];
      }

      const imageUrl = await client.query(api.uploadedImages.getImageUrl, { storageId });

      if (imageUrl) {
        editor?.chain().focus().setImage({ src: imageUrl }).run();
        toast.success('Image uploaded successfully.');
      } else {
        toast.error('Failed to resolve image URL.');
      }
      isImagePopoverOpen = false;
    } catch (_err) {
      toast.error('Failed to upload image. Please try again.');
    } finally {
      isUploadingImage = false;
    }
  }

  function setLink() {
    const url = window.prompt('Enter URL');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  }

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
        }),
        CodeBlockLowlight.configure({
          lowlight,
          HTMLAttributes: {
            class: 'rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm',
          },
        }),
        Image.configure({
          HTMLAttributes: { class: 'rounded-lg border border-border max-w-full my-4 shadow-sm' },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
        }),
        Mathematics,
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: 'focus:outline-none prose prose-zinc dark:prose-invert max-w-none min-h-[400px] p-6',
        },
        handlePaste: (view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;

          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const src = e.target?.result as string;
                  editor?.chain().focus().setImage({ src }).run();
                };
                reader.readAsDataURL(file);
                return true;
              }
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor: e }) => {
        const html = e.getHTML();
        if (onUpdate && html !== initialContent) onUpdate(html);
      },
      onTransaction: () => {
        tick++;
      },
    });
  });

  onDestroy(() => {
    editor?.destroy();
    if (uploadedStorageIds.length > 0) {
      // Clean up any uploaded images that were never successfully published (still have postId/commentId as null)
      void client
        .mutation(api.uploadedImages.deleteUploadedImages, {
          storageIds: uploadedStorageIds as Id<'_storage'>[],
        })
        .catch((err) => {
          console.error('Failed to clean up pending uploads on destroy:', err);
        });
    }
  });

  const btnClass = 'h-8 w-8 p-0';
</script>

<div class="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
  {#if editor}
    <div class="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-1.5">
      <Button
        variant={checkActive('bold') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold size={16} />
      </Button>
      <Button
        variant={checkActive('italic') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic size={16} />
      </Button>
      <Button
        variant={checkActive('strike') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
      >
        <Strikethrough size={16} />
      </Button>
      <Button
        variant={checkActive('code') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleCode().run()}
        aria-label="Inline Code"
      >
        <Code size={16} />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-6" />

      <Button
        variant={checkActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <Heading1 size={16} />
      </Button>
      <Button
        variant={checkActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 size={16} />
      </Button>
      <Button
        variant={checkActive('bulletList') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleBulletList().run()}
        aria-label="Bullet List"
      >
        <List size={16} />
      </Button>
      <Button
        variant={checkActive('orderedList') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered List"
      >
        <ListOrdered size={16} />
      </Button>

      <Separator orientation="vertical" class="mx-1 h-6" />

      <Button
        variant={checkActive('blockquote') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleBlockquote().run()}
        aria-label="Blockquote"
      >
        <Quote size={16} />
      </Button>
      <Popover.Root bind:open={isImagePopoverOpen}>
        <Popover.Trigger>
          <Button variant="ghost" size="icon" class={btnClass}>
            <ImageIcon size={16} />
          </Button>
        </Popover.Trigger>
        <Popover.Content class="flex w-80 flex-col gap-3 p-4">
          <Popover.Header class="p-0">
            <Popover.Title class="text-sm font-bold text-foreground">Insert Image</Popover.Title>
          </Popover.Header>

          <div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5 text-xs">
            <button
              type="button"
              onclick={() => (imageTab = 'upload')}
              class={`rounded px-2 py-1 font-medium transition-all ${imageTab === 'upload' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Upload
            </button>
            <button
              type="button"
              onclick={() => (imageTab = 'url')}
              class={`rounded px-2 py-1 font-medium transition-all ${imageTab === 'url' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Paste URL
            </button>
          </div>

          {#if imageTab === 'upload'}
            <div class="flex flex-col gap-2">
              {#if isUploadingImage}
                <div
                  class="flex h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/5 text-xs text-muted-foreground"
                >
                  <Loader2 class="h-5 w-5 animate-spin text-primary" />
                  <span>Uploading to Convex...</span>
                </div>
              {:else}
                <button
                  type="button"
                  onclick={() => document.getElementById('tiptap-image-file')?.click()}
                  class="flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/20 text-center text-xs text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/10"
                >
                  <UploadCloud class="h-6 w-6 text-primary/60" />
                  <span>Click to browse or upload</span>
                  <input
                    id="tiptap-image-file"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    onchange={handleImageUpload}
                  />
                </button>
              {/if}
            </div>
          {:else}
            <div class="flex flex-col gap-2">
              <Input
                type="text"
                placeholder="https://example.com/image.png"
                bind:value={imageUrlInput}
                class="h-8 border-border bg-muted/10 text-xs"
              />
              <Button size="sm" onclick={insertImageUrl} class="h-8 text-xs font-semibold">Insert Image</Button>
            </div>
          {/if}
        </Popover.Content>
      </Popover.Root>
      <Button
        variant={checkActive('link') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={setLink}
        aria-label="Insert Link"
      >
        <LinkIcon size={16} />
      </Button>
      <Button
        variant={checkActive('codeBlock') ? 'secondary' : 'ghost'}
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
        aria-label="Code Block"
      >
        <SquareCode size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class={btnClass}
        onclick={() => editor?.chain().focus().insertContent('$x$').run()}
        title="Insert Math (LaTeX)"
      >
        <Sigma size={16} />
      </Button>

      <div class="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class={btnClass}
          onclick={() => editor?.chain().focus().undo().run()}
          aria-label="Undo"
          disabled={!canUndo()}
        >
          <Undo size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class={btnClass}
          onclick={() => editor?.chain().focus().redo().run()}
          aria-label="Redo"
          disabled={!canRedo()}
        >
          <Redo size={16} />
        </Button>
      </div>
    </div>
  {/if}

  <div bind:this={element} class="bg-background"></div>
</div>

<style>
  /* Force Tailwind Prose to drop its hardcoded white text and obey Shadcn */
  :global(.tiptap pre) {
    background-color: hsl(var(--muted) / 0.5) !important;
    color: hsl(var(--foreground)) !important;
  }

  :global(.tiptap pre code) {
    background: transparent !important;
    color: inherit !important;
  }

  /* Syntax Highlighting Colors */
  :global(.hljs-keyword),
  :global(.hljs-operator),
  :global(.hljs-selector-tag),
  :global(.hljs-type),
  :global(.hljs-built_in) {
    color: hsl(var(--primary));
    font-weight: 600;
  }

  :global(.hljs-string),
  :global(.hljs-regexp),
  :global(.hljs-literal),
  :global(.hljs-symbol) {
    color: hsl(var(--chart-1, var(--primary)));
  }

  :global(.hljs-number),
  :global(.hljs-boolean) {
    color: hsl(var(--chart-2, var(--destructive)));
  }

  :global(.hljs-title),
  :global(.hljs-title.function_),
  :global(.hljs-title.class_),
  :global(.hljs-attr),
  :global(.hljs-property) {
    color: hsl(var(--chart-3, var(--ring)));
  }

  :global(.hljs-comment),
  :global(.hljs-meta) {
    color: hsl(var(--muted-foreground));
    font-style: italic;
  }

  :global(.hljs-tag),
  :global(.hljs-name) {
    color: hsl(var(--chart-4, var(--accent-foreground)));
  }
</style>

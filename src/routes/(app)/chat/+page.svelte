<script lang="ts">
  import ImageIcon from '@lucide/svelte/icons/image';
  import MoreVertical from '@lucide/svelte/icons/more-vertical';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Reply from '@lucide/svelte/icons/reply';
  import Send from '@lucide/svelte/icons/send';
  import Smile from '@lucide/svelte/icons/smile';
  import Trash from '@lucide/svelte/icons/trash';
  import Users from '@lucide/svelte/icons/users';
  import X from '@lucide/svelte/icons/x';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Doc, Id } from '$convex/_generated/dataModel';

  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Checkbox } from '$lib/components/ui/checkbox/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as Resizable from '$lib/components/ui/resizable/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';
  import { cn } from '$lib/utils';

  const client = useConvexClient();
  let selectedChatId = $state<Id<'chats'> | null>(null);
  let showCreateGroup = $state(false);
  let groupName = $state('');
  let selectedMemberIds = $state<Id<'users'>[]>([]);

  $effect(() => {
    const cid = page.url.searchParams.get('chatId');
    if (cid) {
      selectedChatId = cid as Id<'chats'>;
    }
  });

  let newMessage = $state('');
  let viewportRef = $state<HTMLElement | null>(null);
  let editingMessageId = $state<Id<'messages'> | null>(null);
  let editingContent = $state('');
  let isSending = $state(false);
  let isSavingEdit = $state(false);
  let isUploadingImage = $state(false);

  let selectedImageUrl = $state<string | null>(null);
  let replyToId = $state<Id<'messages'> | null>(null);
  let replyToSender = $state<string>('');
  let replyToContent = $state<string>('');

  const chatsQuery = useQuery(api.chats.listByUser, () => ($session?.userId ? { userId: $session.userId } : 'skip'));

  const messagesQuery = useQuery(api.messages.listWithSender, () =>
    selectedChatId ? { chatId: selectedChatId } : 'skip',
  );

  const allUsersQuery = useQuery(api.users.list);

  const typingUsersQuery = useQuery(api.messages.getTypingUsers, () =>
    selectedChatId && $session?.userId ? { chatId: selectedChatId, currentUserId: $session.userId } : 'skip',
  );

  async function handleImageUpload(file: File) {
    if (!selectedChatId || !$session?.userId || isUploadingImage) return;
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('Image must be less than 5MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed.');
      return;
    }
    isUploadingImage = true;
    try {
      const uploadUrl = await client.mutation(api.uploadedImages.generateUploadUrl, {});
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) throw new Error('Upload failed');
      const { storageId } = await response.json();
      await client.mutation(api.messages.send, {
        chatId: selectedChatId,
        senderId: $session.userId,
        content: '',
        imageStorageId: storageId as Id<'_storage'>,
      });
    } catch (_err) {
      toast.error('Failed to upload image.');
    } finally {
      isUploadingImage = false;
    }
  }

  let fileInput: HTMLInputElement | undefined = $state();

  function triggerImageUpload() {
    fileInput?.click();
  }

  async function sendMessage() {
    if (!selectedChatId || !$session?.userId || isSending) return;
    const content = newMessage.trim();
    if (!content && !replyToId) return;
    isSending = true;
    newMessage = '';
    try {
      await client.mutation(api.messages.send, {
        chatId: selectedChatId,
        senderId: $session.userId,
        content,
        ...(replyToId ? { replyToId } : {}),
      });
      replyToId = null;
      replyToSender = '';
      replyToContent = '';
    } catch (_err) {
      toast.error('Failed to send message.');
    } finally {
      isSending = false;
    }
  }

  function startEditing(
    msg:
      | (Doc<'messages'> & { senderName: string; senderAvatar: string | null })
      | NonNullable<typeof messagesQuery.data>[number],
  ) {
    editingMessageId = msg._id;
    editingContent = msg.content;
  }

  function cancelEditing() {
    editingMessageId = null;
    editingContent = '';
  }

  async function saveEdit() {
    if (!editingMessageId || !editingContent.trim() || isSavingEdit) return;
    isSavingEdit = true;
    try {
      await client.mutation(api.messages.edit, { id: editingMessageId, content: editingContent });
      editingMessageId = null;
      editingContent = '';
    } catch (_err) {
      toast.error('Failed to edit message.');
    } finally {
      isSavingEdit = false;
    }
  }

  async function deleteMessage(id: Id<'messages'>) {
    try {
      await client.mutation(api.messages.remove, { id });
    } catch (_err) {
      toast.error('Failed to delete message.');
    }
  }

  async function toggleReaction(messageId: Id<'messages'>, emoji: string) {
    if (!$session?.userId) return;
    try {
      await client.mutation(api.messages.toggleReaction, { messageId, userId: $session.userId, emoji });
    } catch (_err) {
      toast.error('Failed to toggle reaction.');
    }
  }

  function startReply(
    msg:
      | (Doc<'messages'> & { senderName: string; senderAvatar: string | null })
      | NonNullable<typeof messagesQuery.data>[number],
  ) {
    replyToId = msg._id;
    replyToSender = msg.senderName;
    replyToContent = msg.content;
  }

  function cancelReply() {
    replyToId = null;
    replyToSender = '';
    replyToContent = '';
  }

  async function createGroup() {
    if (!groupName.trim() || selectedMemberIds.length === 0 || !$session?.userId) return;
    try {
      const memberIds = [...selectedMemberIds, $session.userId as Id<'users'>];
      const chatId = await client.mutation(api.chats.create, { name: groupName.trim(), memberIds });
      selectedChatId = chatId;
      groupName = '';
      selectedMemberIds = [];
      showCreateGroup = false;
      history.replaceState(null, '', `/chat?chatId=${chatId}`);
    } catch (_err) {
      toast.error('Failed to create group.');
    }
  }

  const availableUsers = $derived(allUsersQuery.data?.filter((u) => u._id !== $session?.userId) ?? []);

  async function markRead() {
    if (!selectedChatId || !$session?.userId) return;
    try {
      await client.mutation(api.messages.markRead, { chatId: selectedChatId, userId: $session.userId });
    } catch {
      /* silently fail */
    }
  }

  let typingTimeout: ReturnType<typeof setTimeout> | undefined;

  function handleTyping() {
    const cid = selectedChatId;
    if (!cid || !$session?.userId) return;
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      client.mutation(api.messages.updateTyping, { chatId: cid, userId: $session.userId! }).catch(() => {});
    }, 300);
  }

  $effect(() => {
    if (selectedChatId) {
      markRead();
    }
  });

  const selectedChat = $derived(chatsQuery.data?.find((c) => c?._id === selectedChatId));

  $effect(() => {
    if (messagesQuery.data && viewportRef) {
      setTimeout(() => {
        viewportRef?.scrollTo({
          top: viewportRef.scrollHeight,
          behavior: 'smooth',
        });
      }, 50);
    }
  });

  function formatRelativeTime(timestamp: number) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'];

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  function userHasReacted(reactions: Array<{ emoji: string; count: number; userIds: Id<'users'>[] }>, emoji: string) {
    return reactions.find((r) => r.emoji === emoji)?.userIds.includes($session?.userId as Id<'users'>) ?? false;
  }
</script>

<div class="flex h-full w-full flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
  <Resizable.PaneGroup direction="horizontal" class="h-full w-full">
    <!-- Chat List -->
    <Resizable.Pane defaultSize={18} minSize={16} maxSize={30} class="flex flex-col border-r bg-muted/10">
      <div class="flex items-center justify-between p-4">
        <h2 class="text-xl font-bold tracking-tight">Chats</h2>
        <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => (showCreateGroup = true)}>
          <Pencil class="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <ScrollArea class="flex-1">
        <div class="flex flex-col gap-1 p-2">
          {#if chatsQuery.isLoading}
            {#each [1, 2, 3, 4] as i (i)}
              <div class="flex items-center gap-3 rounded-lg p-3">
                <Skeleton class="h-10 w-10 rounded-full" />
                <div class="flex-1 space-y-1.5">
                  <Skeleton class="h-4 w-32" />
                  <Skeleton class="h-3 w-48" />
                </div>
              </div>
            {/each}
          {:else if chatsQuery.data?.length === 0}
            <div class="p-4 text-center text-sm text-muted-foreground">No chats found</div>
          {:else}
            {#each chatsQuery.data ?? [] as chat (chat?._id)}
              {#if chat}
                <button
                  onclick={() => {
                    selectedChatId = chat._id;
                    history.replaceState(null, '', `/chat?chatId=${chat._id}`);
                  }}
                  class={cn(
                    'flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all duration-200 hover:bg-muted/50',
                    selectedChatId === chat._id && 'bg-primary/10 hover:bg-primary/15',
                  )}
                >
                  <Avatar.Root class="h-10 w-10 border shadow-sm">
                    <Avatar.Image
                      src={chat.displayAvatar ??
                        `https://api.dicebear.com/9.x/shapes/svg?seed=${chat.displayName ?? chat.name}`}
                    />
                    <Avatar.Fallback class="bg-primary/5 text-primary">
                      {(chat.displayName ?? chat.name).substring(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div class="flex-1 overflow-hidden">
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate font-semibold">{chat.displayName ?? chat.name}</span>
                      {#if chat.lastMessageAt}
                        <span class="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelativeTime(chat.lastMessageAt)}
                        </span>
                      {/if}
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate text-xs text-muted-foreground">
                        {#if chat.lastMessageSnippet}
                          {#if chat.lastMessageSenderId === $session?.userId}
                            <span class="font-medium">You: </span>
                          {/if}
                          {chat.lastMessageSnippet.length > 40
                            ? chat.lastMessageSnippet.substring(0, 40) + '...'
                            : chat.lastMessageSnippet}
                        {:else}
                          <span class="italic">No messages yet</span>
                        {/if}
                      </span>
                      {#if chat.unreadCount > 0}
                        <Badge
                          variant="default"
                          class="flex h-5 min-w-5 shrink-0 items-center justify-center px-1 text-[10px]"
                        >
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </Badge>
                      {/if}
                    </div>
                  </div>
                </button>
              {/if}
            {/each}
          {/if}
        </div>
      </ScrollArea>
    </Resizable.Pane>

    <Resizable.Handle withHandle />

    <!-- Chat Window -->
    <Resizable.Pane defaultSize={84} class="flex flex-col bg-background">
      {#if selectedChatId && selectedChat}
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 p-4 shadow-sm">
          <div class="flex items-center gap-3">
            <Avatar.Root class="h-8 w-8 border">
              <Avatar.Image
                src={selectedChat.displayAvatar ??
                  `https://api.dicebear.com/9.x/shapes/svg?seed=${selectedChat.displayName ?? selectedChat.name}`}
              />
              <Avatar.Fallback class="bg-primary/5 text-xs text-nowrap text-primary">
                {(selectedChat.displayName ?? selectedChat.name).substring(0, 2).toUpperCase()}
              </Avatar.Fallback>
            </Avatar.Root>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <h3 class="font-bold">{selectedChat.displayName ?? selectedChat.name}</h3>
              </div>
              {#if typingUsersQuery.data && typingUsersQuery.data.length > 0}
                <span class="text-[11px] text-muted-foreground italic">
                  {typingUsersQuery.data.map((u) => u.name).join(', ')} typing...
                </span>
              {/if}
            </div>
          </div>
        </div>
        <Separator />

        <!-- Messages -->
        <ScrollArea class="flex-1" bind:viewportRef>
          <div class="flex flex-col gap-4 p-6">
            {#if messagesQuery.isLoading}
              <div class="flex flex-col gap-6 p-6">
                {#each [1, 2, 3] as i (i)}
                  <div class="flex items-start gap-3">
                    <Skeleton class="h-8 w-8 shrink-0 rounded-full" />
                    <div class="flex flex-col gap-2">
                      <Skeleton class="h-3 w-16" />
                      <div class="rounded-2xl rounded-tl-none bg-muted p-4 shadow-sm">
                        <div class="space-y-2">
                          <Skeleton class="h-4 w-48" />
                          <Skeleton class="h-4 w-32" />
                        </div>
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else if messagesQuery.data?.length === 0}
              <div class="flex h-full items-center justify-center py-10">
                <span class="text-sm text-muted-foreground italic">No messages yet. Say hello!</span>
              </div>
            {:else}
              {#each messagesQuery.data ?? [] as msg (msg._id)}
                <div class="group relative flex items-start gap-3" id="msg-{msg._id}">
                  <a href="/users/{msg.senderId}" class="shrink-0">
                    <Avatar.Root class="h-8 w-8 border">
                      <Avatar.Image src={msg.senderAvatar ?? undefined} />
                      <Avatar.Fallback class="text-nowrap"
                        >{msg.senderName.substring(0, 2).toUpperCase()}</Avatar.Fallback
                      >
                    </Avatar.Root>
                  </a>
                  <div class={cn('flex flex-col gap-1.5', editingMessageId === msg._id ? 'flex-1' : 'max-w-[80%]')}>
                    <div class="flex items-baseline gap-2">
                      <a href="/users/{msg.senderId}" class="text-sm font-semibold hover:underline">{msg.senderName}</a>
                      <span class="text-[10px] text-muted-foreground">{formatRelativeTime(msg.sentAt)}</span>
                    </div>

                    {#if msg.replyTo}
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-center gap-2 rounded-lg border-l-4 border-muted-foreground/30 bg-muted/50 px-3 py-1.5 text-left text-xs text-muted-foreground"
                        onclick={() => {
                          const el = document.getElementById('msg-' + msg.replyTo!.senderId);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        <Reply class="h-3 w-3 shrink-0" />
                        <span class="truncate font-medium">{msg.replyTo.senderName}: </span>
                        <span class="truncate">{msg.replyTo.content}</span>
                      </button>
                    {/if}

                    {#if editingMessageId === msg._id}
                      <div class="flex w-full flex-col gap-2">
                        <Input
                          bind:value={editingContent}
                          onkeydown={(e) => e.key === 'Enter' && saveEdit()}
                          class="w-full"
                        />
                        <div class="flex gap-2">
                          <Button size="sm" onclick={saveEdit} disabled={isSavingEdit}>
                            {#if isSavingEdit}
                              Saving...
                            {:else}
                              Save
                            {/if}
                          </Button>
                          <Button size="sm" variant="ghost" onclick={cancelEditing}>Cancel</Button>
                        </div>
                      </div>
                    {:else}
                      <div class="flex flex-col gap-1">
                        {#if msg.content}
                          <div class="rounded-2xl rounded-tl-none bg-muted px-4 py-2 text-sm shadow-sm">
                            {msg.content}
                          </div>
                        {/if}
                        {#if msg.imageUrl}
                          <button type="button" onclick={() => (selectedImageUrl = msg.imageUrl)} class="text-left">
                            <img
                              src={msg.imageUrl}
                              alt=""
                              class="max-w-xs cursor-pointer rounded-2xl rounded-tl-none border shadow-sm transition-opacity hover:opacity-80"
                              loading="lazy"
                            />
                          </button>
                        {/if}
                      </div>
                    {/if}

                    <!-- Reactions -->
                    <div class="flex flex-wrap gap-1">
                      {#if msg.reactions && msg.reactions.length > 0}
                        {#each msg.reactions as reaction (reaction.emoji)}
                          <button
                            onclick={() => toggleReaction(msg._id, reaction.emoji)}
                            class={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted',
                              userHasReacted(msg.reactions!, reaction.emoji) && 'border-primary bg-primary/10',
                            )}
                          >
                            {reaction.emoji}
                            <span class="text-[10px] text-muted-foreground">{reaction.count}</span>
                          </button>
                        {/each}
                      {/if}
                      <Popover.Root>
                        <Popover.Trigger>
                          {#snippet child({ props })}
                            <button
                              {...props}
                              class="inline-flex items-center rounded-full border p-1 text-xs opacity-0 transition-all group-hover:opacity-100 hover:bg-muted"
                            >
                              <Smile class="h-3 w-3" />
                            </button>
                          {/snippet}
                        </Popover.Trigger>
                        <Popover.Content class="flex w-fit gap-1 p-2" align="start">
                          {#each REACTION_EMOJIS as emoji (emoji)}
                            <button
                              onclick={() => toggleReaction(msg._id, emoji)}
                              class="rounded-md p-1 text-lg transition-colors hover:bg-muted"
                            >
                              {emoji}
                            </button>
                          {/each}
                        </Popover.Content>
                      </Popover.Root>
                    </div>
                  </div>

                  <!-- Actions -->
                  {#if editingMessageId !== msg._id && (msg.senderId === $session?.userId || $session?.role === 'teacher' || $session?.role === 'admin')}
                    <div class="absolute top-0 -right-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          {#snippet child({ props })}
                            <Button {...props} variant="ghost" size="icon" class="h-8 w-8">
                              <MoreVertical class="h-4 w-4" />
                            </Button>
                          {/snippet}
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item onclick={() => startReply(msg)}>
                            <Reply class="mr-2 h-4 w-4" />
                            Reply
                          </DropdownMenu.Item>
                          {#if msg.senderId === $session?.userId}
                            <DropdownMenu.Item onclick={() => startEditing(msg)}>
                              <Pencil class="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenu.Item>
                          {/if}
                          <DropdownMenu.Item
                            class="text-destructive focus:text-destructive"
                            onclick={() => deleteMessage(msg._id)}
                          >
                            <Trash class="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </ScrollArea>

        <!-- Reply Bar -->
        {#if replyToId}
          <div class="flex items-center gap-2 border-t bg-muted/30 px-4 py-2">
            <Reply class="h-3 w-3 shrink-0 text-muted-foreground" />
            <div class="flex-1 truncate text-xs text-muted-foreground">
              <span class="font-medium">{replyToSender}: </span>
              {replyToContent}
            </div>
            <Button variant="ghost" size="icon" class="h-6 w-6" onclick={cancelReply}>
              <X class="h-3 w-3" />
            </Button>
          </div>
        {/if}

        <!-- Input -->
        <Separator />
        <div class="p-4">
          <form
            onsubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            class="flex items-center gap-2"
          >
            <div
              class="flex flex-1 items-center gap-1 rounded-lg border border-input bg-input/20 px-2 focus-within:ring-2 focus-within:ring-ring/30"
            >
              <Popover.Root>
                <Popover.Trigger>
                  {#snippet child({ props })}
                    <button {...props} type="button" class="shrink-0 text-muted-foreground hover:text-foreground">
                      <Smile class="h-4 w-4" />
                    </button>
                  {/snippet}
                </Popover.Trigger>
                <Popover.Content class="flex w-fit flex-wrap gap-1 p-2" align="start" side="top">
                  {#each EMOJI_LIST as emoji (emoji)}
                    <button
                      type="button"
                      onclick={() => (newMessage += emoji)}
                      class="rounded-md p-1 text-lg transition-colors hover:bg-muted"
                    >
                      {emoji}
                    </button>
                  {/each}
                </Popover.Content>
              </Popover.Root>

              <Input
                placeholder="Type a message..."
                bind:value={newMessage}
                oninput={handleTyping}
                class="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <input
              type="file"
              accept="image/*"
              class="hidden"
              bind:this={fileInput}
              onchange={(e) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (file) handleImageUpload(file);
                target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isUploadingImage}
              onclick={triggerImageUpload}
              class="shrink-0"
            >
              {#if isUploadingImage}
                <Spinner class="h-4 w-4" />
              {:else}
                <ImageIcon class="h-4 w-4" />
              {/if}
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={(!newMessage.trim() && !replyToId) || isSending}
              class="shrink-0"
            >
              {#if isSending}
                <Spinner class="h-4 w-4" />
              {:else}
                <Send class="h-4 w-4" />
              {/if}
            </Button>
          </form>
        </div>
      {:else}
        <div class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
          <div class="rounded-full bg-muted p-6">
            <Send class="h-12 w-12 opacity-20" />
          </div>
          <div class="max-w-[200px]">
            <h3 class="text-lg font-semibold text-foreground">Select a chat</h3>
            <p class="text-sm">Choose a conversation from the sidebar to start messaging.</p>
          </div>
        </div>
      {/if}
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>

<!-- Image Viewer Dialog -->
<Dialog.Root open={!!selectedImageUrl} onOpenChange={(o) => !o && (selectedImageUrl = null)}>
  <Dialog.Content class="max-h-[95vh] max-w-[95vw] !rounded-none !bg-transparent !p-0 !ring-0 sm:max-w-[95vw]">
    <Dialog.Close
      class="absolute top-2 right-2 z-10 rounded-full bg-background/80 p-2 text-foreground backdrop-blur-sm"
    >
      <X class="h-5 w-5" />
    </Dialog.Close>
    {#if selectedImageUrl}
      <img src={selectedImageUrl} alt="" class="max-h-[85vh] w-full rounded-xl object-contain shadow-2xl" />
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Create Group Dialog -->
<Dialog.Root open={showCreateGroup} onOpenChange={(o) => !o && (showCreateGroup = false)}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Create Group Chat</Dialog.Title>
      <Dialog.Description>Name your group and add members.</Dialog.Description>
    </Dialog.Header>
    <div class="flex flex-col gap-4 py-4">
      <Input placeholder="Group name" bind:value={groupName} />
      <div class="flex flex-col gap-2">
        <span class="text-sm font-medium" id="members-label">Members</span>
        <ScrollArea class="max-h-60">
          <div class="flex flex-col gap-2">
            {#each availableUsers as user (user._id)}
              <label class="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted">
                <Checkbox
                  checked={selectedMemberIds.includes(user._id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectedMemberIds = [...selectedMemberIds, user._id];
                    } else {
                      selectedMemberIds = selectedMemberIds.filter((id) => id !== user._id);
                    }
                  }}
                />
                <Avatar.Root class="h-8 w-8 border">
                  <Avatar.Image src={user.avatarUrl ?? undefined} />
                  <Avatar.Fallback>{user.name.substring(0, 2).toUpperCase()}</Avatar.Fallback>
                </Avatar.Root>
                <span class="text-sm">{user.name}</span>
              </label>
            {/each}
          </div>
        </ScrollArea>
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="ghost" onclick={() => (showCreateGroup = false)}>Cancel</Button>
      <Button onclick={createGroup} disabled={!groupName.trim() || selectedMemberIds.length === 0}>
        <Users class="mr-2 h-4 w-4" />
        Create Group
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

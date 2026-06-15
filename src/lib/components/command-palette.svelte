<script lang="ts">
  import ActivityIcon from '@lucide/svelte/icons/activity';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import BookOpenCheckIcon from '@lucide/svelte/icons/book-open-check';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CctvIcon from '@lucide/svelte/icons/cctv';
  import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
  import GaugeIcon from '@lucide/svelte/icons/gauge';
  import GlobeIcon from '@lucide/svelte/icons/globe';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
  import MessageSquareIcon from '@lucide/svelte/icons/message-square';
  import MessagesSquareIcon from '@lucide/svelte/icons/messages-square';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlayCircleIcon from '@lucide/svelte/icons/play-circle';
  import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import SunIcon from '@lucide/svelte/icons/sun';
  import UserIcon from '@lucide/svelte/icons/user';
  import UsersIcon from '@lucide/svelte/icons/users';
  import { useQuery } from 'convex-svelte';
  import { mode, toggleMode } from 'mode-watcher';
  import { onMount } from 'svelte';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import * as Command from '$lib/components/ui/command/index.js';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { clearSession, session } from '$lib/session';
  import { screenShareState } from '$lib/sharescreen.svelte';

  let open = $state(false);

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      open = true;
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });

  const currentSession = $derived($session);

  interface Item {
    title: string;
    url: string;
    icon: typeof GaugeIcon;
    badge?: string;
  }

  const localeLabels: Record<string, string> = {
    en: 'English',
    bn: 'বাংলা',
  };

  function handleLogout() {
    open = false;
    clearSession();
    goto('/login');
  }

  const platformItems = $derived<Item[]>([
    { title: 'Dashboard', url: '/dashboard', icon: GaugeIcon },
    { title: 'Sections', url: '/sections', icon: LayersIcon },
    { title: 'Activities', url: '/activities', icon: CalendarIcon },
    { title: 'Settings', url: '/settings', icon: SettingsIcon },
    ...(currentSession?.role === 'teacher' || currentSession?.role === 'admin'
      ? [{ title: 'Problems', url: '/problems', icon: BookOpenIcon }]
      : []),
    ...(currentSession?.role === 'student'
      ? [
          {
            title: 'Share Screen',
            url: '/sharescreen',
            icon: ScreenShareIcon,
            badge: screenShareState.sharing ? 'ON' : undefined,
          },
        ]
      : []),
  ]);

  const adminItems = $derived<Item[]>(
    currentSession?.role === 'admin'
      ? [
          { title: 'Admin Overview', url: '/admin', icon: ShieldIcon },
          { title: 'Manage Users', url: '/admin/users', icon: UsersIcon },
        ]
      : [],
  );

  const allPageItems = $derived<Item[]>([
    ...platformItems,
    ...adminItems,
    { title: 'Forum', url: '/forum', icon: MessagesSquareIcon },
    { title: 'Chat', url: '/chat', icon: MessageSquareIcon },
    ...(currentSession ? [{ title: 'My Profile', url: `/users/${currentSession.userId}`, icon: UserIcon }] : []),
  ]);

  const teacherSectionsQuery = useQuery(api.sections.listSectionsByTeacher, () =>
    currentSession?.role === 'teacher' ? { teacherId: currentSession.userId } : 'skip',
  );
  const studentSectionsQuery = useQuery(api.sections.listSectionsByStudent, () =>
    currentSession?.role === 'student' ? { studentId: currentSession.userId } : 'skip',
  );
  const sections = $derived(
    currentSession?.role === 'teacher' ? (teacherSectionsQuery.data ?? []) : (studentSectionsQuery.data ?? []),
  );

  const postsQuery = useQuery(api.posts.list, () =>
    currentSession ? { userId: currentSession.userId, sortBy: 'new' as const } : 'skip',
  );
  const recentPosts = $derived((postsQuery.data ?? []).slice(0, 5));

  const chatsQuery = useQuery(api.chats.listByUser, () =>
    currentSession ? { userId: currentSession.userId } : 'skip',
  );
</script>

<Command.Dialog bind:open class="sm:max-w-xl">
  <Command.Input placeholder="Type a command or search..." />
  <Command.List class="max-h-96">
    <Command.Empty>No results found.</Command.Empty>

    <Command.Group heading="Pages">
      {#each allPageItems as item (item.url)}
        <Command.Item
          onSelect={() => {
            goto(item.url);
            open = false;
          }}
        >
          <item.icon class="size-4" />
          <span>{item.title}</span>
          {#if item.badge}
            <span class="ml-auto text-[9px] font-extrabold tracking-wider text-success uppercase">{item.badge}</span>
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>

    {#if currentSession && sections.length > 0}
      <Command.Separator />
      <Command.Group heading="My Sections">
        {#each sections as section (section?._id)}
          {#if section}
            {@const now = Date.now()}
            {@const activitiesQuery = useQuery(api.activities.listBySection, () => ({ sectionId: section._id }))}
            {@const activeActivities = (activitiesQuery.data ?? []).filter(
              (a) => a.startTime <= now && now <= a.endTime,
            )}

            <Command.Item
              onSelect={() => {
                goto(`/sections/${section._id}`);
                open = false;
              }}
            >
              <FolderOpenIcon class="size-4" />
              <span>{section.name}</span>
            </Command.Item>

            {#if currentSession.role === 'teacher'}
              <Command.Item
                onSelect={() => {
                  goto(`/sections/${section._id}/cctv`);
                  open = false;
                }}
              >
                <CctvIcon class="size-4" />
                <span>{section.name} / CCTV Hub</span>
              </Command.Item>

              {#if activeActivities.length > 0}
                {#each activeActivities as activity (activity._id)}
                  <Command.Item
                    onSelect={() => {
                      goto(`/activities/${activity._id}`);
                      open = false;
                    }}
                  >
                    <ActivityIcon class="size-4" />
                    <span>{section.name} / {activity.title} / Status</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      goto(`/activities/${activity._id}/playback`);
                      open = false;
                    }}
                  >
                    <PlayCircleIcon class="size-4" />
                    <span>{section.name} / {activity.title} / Playback</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      goto(`/activities/${activity._id}/edit`);
                      open = false;
                    }}
                  >
                    <PencilIcon class="size-4" />
                    <span>{section.name} / {activity.title} / Edit</span>
                  </Command.Item>
                {/each}
              {/if}
            {/if}

            {#if currentSession.role === 'student'}
              {#each activeActivities as activity (activity._id)}
                {@const problemsQuery = useQuery(api.activities.listProblems, () => ({ activityId: activity._id }))}
                {@const problems = problemsQuery.data ?? []}

                <Command.Item
                  onSelect={() => {
                    goto(`/activities/${activity._id}`);
                    open = false;
                  }}
                >
                  <BookOpenCheckIcon class="size-4" />
                  <span>{section.name} / {activity.title}</span>
                </Command.Item>

                {#each problems as p (p._id)}
                  {#if p.problem}
                    <Command.Item
                      onSelect={() => {
                        goto(`/activities/${activity._id}/${p.problem!._id}`);
                        open = false;
                      }}
                    >
                      <BookOpenCheckIcon class="size-4" />
                      <span>{section.name} / {activity.title} / {p.problem.title}</span>
                    </Command.Item>
                  {/if}
                {/each}
              {/each}
            {/if}
          {/if}
        {/each}
      </Command.Group>
    {/if}

    {#if currentSession && (recentPosts.length > 0 || (chatsQuery.data && chatsQuery.data.length > 0))}
      <Command.Separator />
      <Command.Group heading="Recent">
        {#each recentPosts as post (post._id)}
          <Command.Item
            onSelect={() => {
              goto(`/forum/${post._id}`);
              open = false;
            }}
          >
            <SparklesIcon class="size-4" />
            <span class="truncate">{post.title}</span>
          </Command.Item>
        {/each}
        {#if chatsQuery.data}
          {#each chatsQuery.data as chat (chat?._id)}
            {#if chat}
              <Command.Item
                onSelect={() => {
                  goto(`/chat?chatId=${chat._id}`);
                  open = false;
                }}
              >
                <MessageSquareIcon class="size-4" />
                <span class="truncate">{chat.displayName ?? chat.name}</span>
                {#if chat.unreadCount > 0}
                  <span class="ml-auto text-[9px] font-extrabold tracking-wider text-info">{chat.unreadCount}</span>
                {/if}
              </Command.Item>
            {/if}
          {/each}
        {/if}
      </Command.Group>
    {/if}

    <Command.Separator />
    <Command.Group heading="Preferences">
      <Command.Item onSelect={toggleMode}>
        {#if mode.current === 'dark'}
          <SunIcon class="size-4" />
          <span>Light Mode</span>
        {:else}
          <MoonIcon class="size-4" />
          <span>Dark Mode</span>
        {/if}
      </Command.Item>
      {#each locales as locale (locale)}
        <Command.Item
          onSelect={() => {
            setLocale(locale);
            open = false;
          }}
        >
          <GlobeIcon class="size-4" />
          <span>{localeLabels[locale] ?? locale}</span>
          {#if getLocale() === locale}
            <span class="ml-auto text-[9px] font-extrabold text-muted-foreground">Current</span>
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>

    {#if currentSession}
      <Command.Separator />
      <Command.Item onSelect={handleLogout}>
        <LogOutIcon class="size-4" />
        <span>Log out</span>
      </Command.Item>
    {/if}
  </Command.List>
</Command.Dialog>

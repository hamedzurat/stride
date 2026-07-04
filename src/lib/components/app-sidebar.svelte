<script lang="ts">
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import GaugeIcon from '@lucide/svelte/icons/gauge';
  import LayersIcon from '@lucide/svelte/icons/layers';
  import MessageSquareIcon from '@lucide/svelte/icons/message-square';
  import MessagesSquareIcon from '@lucide/svelte/icons/messages-square';
  import ScreenShareIcon from '@lucide/svelte/icons/screen-share';
  import ShieldIcon from '@lucide/svelte/icons/shield';
  import UsersIcon from '@lucide/svelte/icons/users';
  import type { ComponentProps } from 'svelte';

  import favicon from '$lib/assets/favicon.svg';
  import { useSidebar } from '$lib/components/ui/sidebar/context.svelte.js';
  import * as Sidebar from '$lib/components/ui/sidebar/index.js';
  import { session } from '$lib/session';
  import { screenShareState } from '$lib/sharescreen.svelte';

  import NavMain from './nav-main.svelte';
  import NavSections from './nav-sections.svelte';
  import NavUser from './nav-user.svelte';
  import SidebarResizeHandle from './sidebar-resize-handle.svelte';

  let { ref = $bindable(null), collapsible = 'icon', ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

  const sidebar = useSidebar();
  const currentSession = $derived($session);

  // --- Navigation data ---

  const platformItems = $derived([
    { title: 'Dashboard', url: '/dashboard', icon: GaugeIcon },
    { title: 'Sections', url: '/sections', icon: LayersIcon },
    { title: 'Activities', url: '/activities', icon: CalendarIcon },

    // Problems only for teacher/admin
    ...(currentSession?.role === 'teacher' || currentSession?.role === 'admin'
      ? [{ title: 'Problems', url: '/problems', icon: BookOpenIcon }]
      : []),

    // Screen share only for student
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
  ] as { title: string; url: string; icon: typeof GaugeIcon; badge?: string }[]);

  const adminItems: { title: string; url: string; icon: typeof GaugeIcon }[] = [
    { title: 'Overview', url: '/admin', icon: ShieldIcon },
    { title: 'Manage Users', url: '/admin/users', icon: UsersIcon },
  ];

  const commItems: { title: string; url: string; icon: typeof GaugeIcon }[] = [
    { title: 'Forum', url: '/forum', icon: MessagesSquareIcon },
    { title: 'Chat', url: '/chat', icon: MessageSquareIcon },
  ];
</script>

<Sidebar.Root bind:ref {collapsible} {...restProps}>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg" onclick={() => sidebar.toggle()} class="cursor-pointer">
          <div
            class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
          >
            <img src={favicon} alt="Stride" class="size-4 brightness-0 invert" />
          </div>
          <div class="grid flex-1 text-start text-sm leading-tight">
            <span class="truncate font-semibold">Stride</span>
            <span class="truncate text-xs text-sidebar-foreground/60">University Platform</span>
          </div>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>

  <Sidebar.Content>
    <!-- Group 1: Platform -->
    <NavMain label="Platform" items={platformItems} />

    <!-- Group 2: Administration (admin only) -->
    {#if currentSession?.role === 'admin'}
      <NavMain label="Administration" items={adminItems} />
    {/if}

    <!-- Group 3: My Sections (student & teacher only) -->
    {#if currentSession && (currentSession.role === 'student' || currentSession.role === 'teacher')}
      <NavSections session={currentSession} />
    {/if}

    <!-- Group 4: Communication -->
    <NavMain label="Communication" items={commItems} />
  </Sidebar.Content>

  <Sidebar.Footer>
    {#if currentSession}
      <NavUser session={currentSession} />
    {/if}
  </Sidebar.Footer>

  <SidebarResizeHandle />
</Sidebar.Root>

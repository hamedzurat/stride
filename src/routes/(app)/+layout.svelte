<script lang="ts">
  import { useConvexClient } from 'convex-svelte';
  import { getFunctionName } from 'convex/server';
  import gsap from 'gsap';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { goto, onNavigate } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';
  import { PUBLIC_DEMO_MODE } from '$env/static/public';

  import AppSidebar from '$lib/components/app-sidebar.svelte';
  import CommandPalette from '$lib/components/command-palette.svelte';
  import ScreenShareManager from '$lib/components/screen-share-manager.svelte';
  import * as Sidebar from '$lib/components/ui/sidebar/index.js';
  import { isDemoMode } from '$lib/demo-mode';
  import { loadSession, session } from '$lib/session';

  const { children } = $props();
  const currentSession = $derived($session);

  const demo = isDemoMode(PUBLIC_DEMO_MODE);

  const client = useConvexClient();
  if (demo) {
    const realMutation = client.mutation.bind(client);
    const readOnlyMutations = new Set(['users:login']);
    client.mutation = ((name: any, args?: any, options?: any) => {
      const fnName = getFunctionName(name);
      if (readOnlyMutations.has(fnName)) {
        return realMutation(name, args, options);
      }
      toast.info('Demo Mode', {
        description: `Write blocked: ${fnName}`,
        duration: 3000,
      });
      return Promise.resolve(null);
    }) as any;
  }

  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    loadSession();
    const unsub = session.subscribe((s) => {
      if (!s) goto('/login');
    });

    if (!demo) {
      heartbeatInterval = setInterval(() => {
        const s = $session;
        if (s?.userId) {
          client.mutation(api.presence.heartbeat, { userId: s.userId }).catch(() => {});
        }
      }, 30000);
    }

    return () => {
      unsub();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  });

  onNavigate((navigation) => {
    const path = navigation.to?.url?.pathname;
    const appPaths = [
      '/dashboard',
      '/activities',
      '/forum',
      '/problems',
      '/sections',
      '/settings',
      '/chat',
      '/sharescreen',
      '/users',
      '/admin',
    ];
    const isInternal = path && appPaths.some((p) => path === p || path.startsWith(p + '/'));
    if (!isInternal) return;

    const curtain = document.createElement('div');
    curtain.className = 'nav-curtain';

    const content = document.querySelector('[data-slot="sidebar-inset"]');
    if (content) {
      const rect = content.getBoundingClientRect();
      curtain.style.top = `${rect.top}px`;
      curtain.style.left = `${rect.left}px`;
      curtain.style.width = `${rect.width}px`;
      curtain.style.height = `${rect.height}px`;
    } else {
      curtain.style.inset = '0';
    }
    document.body.appendChild(curtain);

    gsap.set(curtain, { clipPath: 'inset(0 100% 0 0)' });

    return new Promise<void>((resolve) => {
      gsap.to(curtain, {
        clipPath: 'inset(0 0% 0 0)',
        duration: 0.25,
        ease: 'power2.out',
        onComplete: async () => {
          resolve();

          await new Promise((r) => setTimeout(r, 50));
          await new Promise((r) => requestAnimationFrame(r));

          gsap.to(curtain, {
            clipPath: 'inset(0 0% 0 100%)',
            duration: 0.4,
            ease: 'power2.inOut',
            onComplete: () => {
              curtain.remove();
            },
          });
        },
      });
    });
  });
</script>

<Sidebar.Provider>
  <AppSidebar />
  <Sidebar.Inset>
    <div class="flex flex-1 flex-col p-2">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>

<CommandPalette />

{#if currentSession?.role === 'student'}
  <ScreenShareManager />
{/if}

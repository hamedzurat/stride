<script lang="ts">
  import { setupConvex } from 'convex-svelte';
  import gsap from 'gsap';
  import { ModeWatcher } from 'mode-watcher';

  import { onNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { PUBLIC_CONVEX_URL } from '$env/static/public';

  import { Toaster } from '$lib/components/ui/sonner/index.js';
  import { locales, localizeHref } from '$lib/paraglide/runtime';
  import { brandLabels, initBrand, setBrand, type Brand } from '$lib/stores/brand.svelte';

  import './layout.css';

  import { toast } from 'svelte-sonner';

  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
  setupConvex(PUBLIC_CONVEX_URL);

  initBrand();

  function handleKeydown(e: KeyboardEvent) {
    if (!e.altKey) return;
    const map: Record<string, Brand> = {
      '1': 'default',
      '2': 'ocean',
      '3': 'forest',
      '4': 'violet',
      '5': 'ruby',
      '6': 'slate',
    };
    const brand = map[e.key];
    if (brand) {
      e.preventDefault();
      setBrand(brand);
      toast.success(`${brandLabels[brand]}`, { description: 'Brand theme applied', duration: 2000 });
    }
  }

  onNavigate((navigation) => {
    const from = navigation.from?.url?.pathname;
    const to = navigation.to?.url?.pathname;
    const isLoginRelated =
      to === '/login' || to === '/forgot-password' || from === '/login' || from === '/forgot-password';
    if (!isLoginRelated) return;

    const curtain = document.createElement('div');
    curtain.className = 'nav-curtain';
    curtain.style.inset = '0';
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

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>Stride</title>
</svelte:head>

<ModeWatcher />
<Toaster />

<svelte:window onkeydown={handleKeydown} />

{@render children()}

<div style="display:none">
  {#each locales as locale (locale)}
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    <a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
  {/each}
</div>

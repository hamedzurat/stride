<script lang="ts">
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
  import InfoIcon from '@lucide/svelte/icons/info';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
  import SunIcon from '@lucide/svelte/icons/sun';
  import { mode, toggleMode } from 'mode-watcher';

  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';

  const sections = [
    {
      title: 'University Project',
      description:
        'Stride is built solely for academic evaluation and course demonstration. It is not a commercial product or service.',
      icon: GraduationCapIcon,
      color: 'text-primary bg-primary/10',
    },
    {
      title: 'Sensitive Data Warning',
      description:
        'Do NOT use real-world passwords, personal email accounts, financial details, or other private information. The security of data submitted to this application is not guaranteed.',
      icon: ShieldAlertIcon,
      color: 'text-destructive bg-destructive/10',
    },
    {
      title: 'No Warranties',
      description:
        'The platform is provided "as-is" without any warranties of any kind. Developers assume no liability for data loss, system downtime, or security issues.',
      icon: InfoIcon,
      color: 'text-info bg-info/10',
    },
  ];
</script>

<div class="relative flex min-h-screen flex-col items-center justify-center bg-background p-6 antialiased md:p-10">
  <!-- Minimalist Background Pattern -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      class="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] mask-[radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)] bg-size-[64px_64px]"
    ></div>
  </div>

  <!-- Theme Toggle Button -->
  <div class="fixed top-4 right-4 z-50">
    <Button
      variant="ghost"
      size="icon"
      onclick={toggleMode}
      class="rounded-full bg-background/20 backdrop-blur-sm hover:bg-background/40"
    >
      {#if mode.current === 'dark'}
        <SunIcon class="size-5" />
      {:else}
        <MoonIcon class="size-5" />
      {/if}
      <span class="sr-only">Toggle Theme</span>
    </Button>
  </div>

  <main class="relative z-10 w-full max-w-2xl">
    <Card.Root class="overflow-hidden border border-border/50 bg-card/65 shadow-xl backdrop-blur-md">
      <Card.Header class="pb-6 text-center">
        <div
          class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <ShieldAlertIcon class="size-6" />
        </div>
        <Badge
          variant="outline"
          class="mx-auto mb-2 border-destructive/20 bg-destructive/5 px-3 py-0.5 text-xs font-semibold tracking-wider text-destructive uppercase"
        >
          Security & Purpose Disclaimer
        </Badge>
        <Card.Title class="text-3xl font-bold tracking-tight">Academic Project Notice</Card.Title>
        <Card.Description class="mt-2 text-balance text-muted-foreground">
          Please read this important notice regarding your privacy and the scope of the Stride platform.
        </Card.Description>
      </Card.Header>

      <Card.Content class="grid gap-6 px-6 py-4 md:px-8">
        {#each sections as sec (sec.title)}
          {@const Icon = sec.icon}
          <div
            class="flex gap-4 rounded-xl border border-border/30 bg-muted/40 p-4 transition-colors hover:bg-muted/60"
          >
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg {sec.color}">
              <Icon class="size-5" />
            </div>
            <div class="space-y-1">
              <h3 class="leading-none font-semibold tracking-tight">{sec.title}</h3>
              <p class="text-sm leading-relaxed text-muted-foreground">{sec.description}</p>
            </div>
          </div>
        {/each}
      </Card.Content>

      <Card.Footer
        class="flex flex-col items-center justify-between gap-4 border-t border-border/40 bg-secondary/15 px-6 py-6 sm:flex-row md:px-8"
      >
        <Button variant="ghost" href="/" class="w-full rounded-full hover:bg-secondary/40 sm:w-auto">
          <ArrowLeftIcon class="mr-2 size-4" />
          Back to Home
        </Button>
        <Button
          href="/login"
          class="w-full rounded-full font-medium shadow-md shadow-primary/10 transition-transform hover:scale-105 active:scale-95 sm:w-auto"
        >
          Proceed to Login
        </Button>
      </Card.Footer>
    </Card.Root>

    <footer class="mt-8 text-center text-xs text-muted-foreground">
      &copy; {new Date().getFullYear()} Stride. All rights reserved.
    </footer>
  </main>
</div>

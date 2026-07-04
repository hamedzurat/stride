<script lang="ts">
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
  import MessageSquareIcon from '@lucide/svelte/icons/message-square';
  import MonitorIcon from '@lucide/svelte/icons/monitor';
  import TerminalIcon from '@lucide/svelte/icons/terminal';

  import previewImage from '$lib/assets/stride-preview.png';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';

  const features = [
    {
      title: 'Real-Time Evaluation',
      description: 'Instant feedback for student code submissions with multi-language support.',
      icon: TerminalIcon,
      color: 'text-primary',
    },
    {
      title: 'Automated Grading',
      description: 'Scalable assessment tools designed for large-scale university programming courses.',
      icon: GraduationCapIcon,
      color: 'text-success',
    },
    {
      title: 'P2P Screenshare',
      description: 'Secure, low-latency live monitoring to support students exactly when they need it.',
      icon: MonitorIcon,
      color: 'text-info',
    },
    {
      title: 'Academic Forum',
      description: 'Integrated community spaces for students and alumni to collaborate and grow.',
      icon: MessageSquareIcon,
      color: 'text-warning',
    },
  ];

  const stats = [
    { label: 'Uptime Guarantee', value: '99.9%' },
    { label: 'Students Evaluated', value: '50k+' },
    { label: 'Partner Institutions', value: '100+' },
    { label: 'Languages Supported', value: '20+' },
  ];
</script>

<div class="relative flex min-h-screen flex-col items-center bg-background antialiased">
  <!-- Minimalist Background Pattern -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <div
      class="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] mask-[radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-size-[64px_64px]"
    ></div>
  </div>

  <main class="relative z-10 flex w-full flex-col items-center">
    <!-- Hero Section: Perfectly Centered -->
    <section class="container mx-auto flex flex-col items-center px-4 pt-16 pb-16 text-center md:pt-24 md:pb-24">
      <div class="flex max-w-4xl flex-col items-center text-center">
        <Badge
          variant="outline"
          class="mb-6 animate-in border-primary/20 bg-primary/5 px-4 py-1 font-medium text-primary duration-700 fade-in slide-in-from-bottom-4"
        >
          Trusted by leading universities worldwide
        </Badge>

        <h1
          class="bg-linear-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-extrabold tracking-tight text-balance text-transparent sm:text-6xl md:text-7xl lg:text-8xl"
        >
          Empower Academic Excellence with <span class="text-primary">Real-Time</span> Assessment
        </h1>

        <p class="mt-8 max-w-2xl text-lg text-balance text-muted-foreground md:text-xl">
          A powerful, scalable platform designed for modern programming curricula. Deliver secure examinations and
          collaborative learning at scale.
        </p>

        <div class="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            href="/login"
            class="h-14 rounded-full px-10 text-base font-semibold shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            Get Started
            <ArrowRightIcon class="ml-2 size-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            href="#features"
            class="h-14 rounded-full px-10 text-base font-semibold backdrop-blur-sm transition-colors hover:bg-secondary/50"
          >
            Explore Features
          </Button>
        </div>
      </div>

      <!-- Preview Mockup -->
      <div class="mt-20 w-full max-w-6xl animate-in duration-1000 fade-in slide-in-from-bottom-8">
        <div
          class="relative rounded-2xl border border-border/50 bg-card/50 p-2 shadow-[0_0_50px_-12px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-2xl dark:shadow-primary/5"
        >
          <div class="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30">
            <img
              src={previewImage}
              alt="Stride Platform Preview"
              class="absolute inset-0 h-full w-full object-cover select-none"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Stats Section: Elegant & Centered -->
    <section class="w-full border-y border-border/40 bg-secondary/10 py-20 backdrop-blur-sm">
      <div class="container mx-auto px-4">
        <div class="mx-auto flex flex-wrap items-center justify-center gap-12 md:gap-24">
          {#each stats as stat (stat.label)}
            <div class="flex flex-col items-center text-center">
              <span
                class="bg-linear-to-b from-primary to-primary/70 bg-clip-text text-4xl font-bold tracking-tighter text-transparent md:text-5xl"
              >
                {stat.value}
              </span>
              <span class="mt-2 text-sm font-medium tracking-widest text-muted-foreground uppercase">
                {stat.label}
              </span>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <!-- Features Section: Modern Minimalist Grid -->
    <section id="features" class="container mx-auto px-4 py-32">
      <div class="mx-auto mb-24 max-w-2xl text-center">
        <h2 class="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Built for the Modern Classroom</h2>
        <p class="mt-6 text-lg text-muted-foreground">
          Everything you need to manage technical education effectively, without the clutter.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-16 md:grid-cols-2 lg:grid-cols-4">
        {#each features as feature (feature.title)}
          {@const Icon = feature.icon}
          <div class="group flex flex-col items-center text-center">
            <div
              class="mb-8 flex size-20 items-center justify-center rounded-3xl bg-secondary/30 transition-all duration-300 group-hover:bg-primary/10 group-hover:shadow-[0_0_30px_-5px_rgba(0,0,0,0.05)] dark:bg-secondary/10"
            >
              <Icon
                size={36}
                strokeWidth={1}
                class="{feature.color} transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <h3 class="text-xl font-bold tracking-tight">{feature.title}</h3>
            <p class="mt-4 leading-relaxed text-balance text-muted-foreground">
              {feature.description}
            </p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Final CTA Section: Impactful -->
    <section class="container mx-auto px-4 py-32">
      <div
        class="relative isolate overflow-hidden rounded-[2.5rem] bg-foreground px-8 py-20 text-center text-background shadow-2xl sm:px-16 md:py-32"
      >
        <!-- Abstract gradient shapes -->
        <div class="absolute -top-24 -left-24 -z-10 size-96 rounded-full bg-primary/20 blur-[100px]"></div>
        <div class="absolute -right-24 -bottom-24 -z-10 size-96 rounded-full bg-primary/10 blur-[100px]"></div>

        <div class="mx-auto max-w-3xl">
          <h2 class="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Ready to transform your academic assessments?
          </h2>
          <p class="mx-auto mt-8 max-w-xl text-lg text-balance text-background/70 md:text-xl">
            Join the leading universities already using Stride to deliver world-class technical education.
          </p>
          <div class="mt-12 flex justify-center">
            <Button
              size="lg"
              variant="secondary"
              href="/login"
              class="h-16 rounded-full px-12 text-lg font-bold shadow-xl transition-all hover:scale-105 hover:bg-pure-white hover:text-pure-black"
            >
              Get Started Now
            </Button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="w-full border-t border-border/40 py-12">
    <div class="container mx-auto flex flex-col items-center justify-between gap-6 px-4 md:flex-row">
      <div class="flex items-center gap-2">
        <span class="text-xl font-bold tracking-tighter">STRIDE</span>
        <span class="border-l pl-2 text-xs font-medium tracking-widest text-muted-foreground uppercase"
          >University Edition</span
        >
      </div>

      <p class="text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Stride. All rights reserved.
      </p>

      <div class="flex gap-8">
        <a href="/disclaimer" class="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >Terms</a
        >
        <a href="/disclaimer" class="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >Privacy</a
        >
        <a
          href="https://github.com/hamedzurat/stride/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">GitHub</a
        >
      </div>
    </div>
  </footer>
</div>

<style>
  :global(html) {
    scroll-behavior: smooth;
  }
</style>

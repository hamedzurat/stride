<script lang="ts">
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Users from '@lucide/svelte/icons/users';
  import { useQuery } from 'convex-svelte';
  import DOMPurify from 'isomorphic-dompurify';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import { PageEmpty, PageHero, PageLayout } from '$lib/components/page/index.js';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { session } from '$lib/session';

  const userId = $derived($session?.userId);
  const userRole = $derived($session?.role);

  // --- Real-time Convex Queries ---
  const sectionsQuery = useQuery(api.sections.listWithMembers, {});

  // --- Reactive Derived States (Svelte 5 Runes) ---
  const sections = $derived(sectionsQuery.data || []);
  let searchQuery = $state('');

  const roleFilteredSections = $derived(
    sections.filter((section: any) => {
      if (userRole === 'admin') return true;
      if (userRole === 'teacher') {
        return section.teachers?.some((t: any) => t._id === userId) ?? false;
      }
      if (userRole === 'student') {
        return section.students?.some((s: any) => s._id === userId) ?? false;
      }
      return false;
    }),
  );

  const filteredSections = $derived(
    roleFilteredSections.filter(
      (section: any) =>
        section.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.aboutMd?.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  // --- Loader State ---
  const isLoading = $derived(sectionsQuery.isLoading);
</script>

<PageLayout>
  <!-- Top Header Action -->
  <PageHero
    title="Academic Sections"
    description="Manage your courses, view assigned schedules, and coordinate students."
  >
    {#snippet actions()}
      {#if userRole === 'admin'}
        <Button href="/sections/new" size="lg" class="font-semibold shadow-sm">
          <Plus class="mr-1.5 size-4" />
          Create Section
        </Button>
      {/if}
    {/snippet}
  </PageHero>

  <!-- Search and Actions Bar -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="relative max-w-md flex-1">
      <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground/75" />
      <Input
        placeholder="Filter by section title or syllabus..."
        class="pl-9 text-xs focus-visible:ring-primary/20"
        bind:value={searchQuery}
      />
    </div>
  </div>

  <!-- Main Content Grid -->
  {#if isLoading}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(3) as _, i (i)}
        <Card.Root class="flex h-[240px] flex-col justify-between border-border bg-card">
          <Card.Header class="gap-2">
            <Skeleton class="h-6 w-3/4" />
            <Skeleton class="h-4 w-1/2" />
          </Card.Header>
          <Card.Content class="gap-2">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-5/6" />
          </Card.Content>
          <Card.Footer>
            <Skeleton class="h-9 w-full" />
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>
  {:else if filteredSections.length === 0}
    <PageEmpty
      icon={GraduationCap}
      title="No Sections Found"
      description={searchQuery
        ? 'Adjust your search query or clear filters to locate matches.'
        : 'No active sections are currently configured.'}
      action={userRole === 'admin' && !searchQuery
        ? { label: 'Create Your First Section', onclick: () => goto('/sections/new') }
        : undefined}
    />
  {:else}
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each filteredSections as section (section._id)}
        <Card.Root
          class="flex h-full flex-col justify-between border border-border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
        >
          <Card.Header class="pb-3">
            <div class="flex items-start justify-between gap-4">
              <Card.Title class="line-clamp-1 text-lg font-bold tracking-tight text-foreground">
                {section.name}
              </Card.Title>
            </div>
            <div
              class="prose prose-sm mt-1 line-clamp-3 max-w-none text-xs text-muted-foreground/90 dark:prose-invert [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1"
            >
              {#if section.aboutMd}
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html DOMPurify.sanitize(section.aboutMd)}
              {:else}
                <p>No description provided.</p>
              {/if}
            </div>
          </Card.Header>

          <Card.Content class="flex flex-1 flex-col justify-end py-2">
            <!-- Instructor left aligned and Enrollment number on right -->
            <div class="flex items-center justify-between border-t border-border/30 pt-3">
              <div class="flex items-center gap-2">
                {#if !section.teachers || section.teachers.length === 0}
                  <span class="text-xs text-muted-foreground italic">No instructor</span>
                {:else}
                  {@const instructor = section.teachers[0]}
                  {#if instructor}
                    <Avatar.Root class="h-6 w-6 border border-border shadow-xs">
                      <Avatar.Image src={instructor.avatarUrl} alt={instructor.name} />
                      <Avatar.Fallback class="bg-primary/5 text-[9px] font-bold text-primary">
                        {instructor.name.substring(0, 2).toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <span class="max-w-[120px] truncate text-xs font-semibold text-foreground" title={instructor.name}>
                      {instructor.name}
                    </span>
                  {/if}
                {/if}
              </div>

              <Badge variant="secondary" class="shrink-0 border-border bg-muted/40 px-2 py-0.5 text-xs font-bold">
                <Users class="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                {(section.students || []).length} Student(s)
              </Badge>
            </div>
          </Card.Content>

          <Card.Footer class="flex gap-2 border-t border-border/40 bg-muted/5 p-3">
            <Button href="/sections/{section._id}" size="lg" class="flex-1 font-semibold">View More</Button>
            {#if userRole === 'admin'}
              <Button href="/sections/{section._id}/edit" variant="outline" size="icon-lg" title="Edit settings">
                <Pencil class="size-3.5" />
              </Button>
            {/if}
          </Card.Footer>
        </Card.Root>
      {/each}
    </div>
  {/if}
</PageLayout>

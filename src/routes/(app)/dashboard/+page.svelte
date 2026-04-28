<script lang="ts">
  import { useQuery } from 'convex-svelte';

  import { api } from '$convex/_generated/api.js';

  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { session } from '$lib/session';

  const userId = $derived($session?.userId);

  const userQuery = useQuery(api.users.get, () => (userId ? { id: userId } : 'skip'));
  const studentSectionsQuery = useQuery(api.sections.listSectionsByStudent, () =>
    userId && $session?.role === 'student' ? { studentId: userId } : 'skip',
  );
  const teacherSectionsQuery = useQuery(api.sections.listSectionsByTeacher, () =>
    userId && $session?.role === 'teacher' ? { teacherId: userId } : 'skip',
  );

  const user = $derived(userQuery.data);
  const sections = $derived(studentSectionsQuery.data || teacherSectionsQuery.data);
  const isLoading = $derived(userQuery.isLoading || studentSectionsQuery.isLoading || teacherSectionsQuery.isLoading);
</script>

<div class="flex flex-col gap-8">
  <!-- Welcome Section -->
  <Card.Root>
    <Card.Content class="flex items-center gap-6 p-6">
      {#if user}
        <Avatar.Root class="h-20 w-20">
          <Avatar.Image src={user.avatarUrl} alt={user.name} />
          <Avatar.Fallback class="text-2xl">{user.name.charAt(0)}</Avatar.Fallback>
        </Avatar.Root>
        <div class="flex flex-col gap-1">
          <h1 class="text-3xl font-bold tracking-tight">Welcome back, {user.name}</h1>
          <div class="flex items-center gap-2">
            <Badge variant="secondary" class="capitalize">{user.role}</Badge>
            <span class="text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>
      {:else if isLoading}
        <Skeleton class="h-20 w-20 rounded-full" />
        <div class="flex flex-col gap-2">
          <Skeleton class="h-8 w-64" />
          <Skeleton class="h-4 w-32" />
        </div>
      {/if}
    </Card.Content>
  </Card.Root>

  <!-- Content Section -->
  <div>
    <h2 class="mb-4 text-xl font-semibold">
      {#if $session?.role === 'teacher'}
        Sections You Teach
      {:else if $session?.role === 'student'}
        Your Sections
      {:else}
        System Overview
      {/if}
    </h2>
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#if sections}
        {#if sections.length === 0}
          <div
            class="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center"
          >
            <p class="text-lg font-medium text-muted-foreground">No sections found</p>
            <p class="text-sm text-muted-foreground">You are not enrolled in any sections yet.</p>
          </div>
        {:else}
          {#each sections as section (section?._id)}
            {#if section}
              <Card.Root class="transition-all hover:shadow-md">
                <Card.Header>
                  <Card.Title>{section.name}</Card.Title>
                  <Card.Description class="line-clamp-2">
                    {#if section.aboutMd}
                      {section.aboutMd}
                    {:else}
                      No description provided.
                    {/if}
                  </Card.Description>
                </Card.Header>
                <Card.Footer>
                  <a href="/sections/{section?._id}" class="text-sm font-medium text-primary hover:underline">
                    View Section details →
                  </a>
                </Card.Footer>
              </Card.Root>
            {/if}
          {/each}
        {/if}
      {:else if isLoading}
        {#each [0, 1, 2] as i (i)}
          <Card.Root>
            <Card.Header class="gap-2">
              <Skeleton class="h-6 w-3/4" />
              <Skeleton class="h-4 w-full" />
            </Card.Header>
            <Card.Footer>
              <Skeleton class="h-4 w-24" />
            </Card.Footer>
          </Card.Root>
        {/each}
      {/if}
    </div>
  </div>
</div>

<script lang="ts">
  import ActivityIcon from '@lucide/svelte/icons/activity';
  import BookOpenCheckIcon from '@lucide/svelte/icons/book-open-check';
  import CctvIcon from '@lucide/svelte/icons/cctv';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import CircleIcon from '@lucide/svelte/icons/circle';
  import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlayCircleIcon from '@lucide/svelte/icons/play-circle';
  import { useQuery } from 'convex-svelte';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import * as Collapsible from '$lib/components/ui/collapsible/index.js';
  import * as Sidebar from '$lib/components/ui/sidebar/index.js';
  import type { Session } from '$lib/session';

  let { session }: { session: Session } = $props();

  // Use two queries and skip the irrelevant one based on role
  const teacherSectionsQuery = useQuery(api.sections.listSectionsByTeacher, () =>
    session.role === 'teacher' ? { teacherId: session.userId } : 'skip',
  );

  const studentSectionsQuery = useQuery(api.sections.listSectionsByStudent, () =>
    session.role === 'student' ? { studentId: session.userId } : 'skip',
  );

  const sections = $derived(
    session.role === 'teacher' ? (teacherSectionsQuery.data ?? []) : (studentSectionsQuery.data ?? []),
  );
</script>

<Sidebar.Group class="group-data-[collapsible=icon]:hidden">
  <Sidebar.GroupLabel>My Sections</Sidebar.GroupLabel>
  <Sidebar.Menu>
    {#if sections.length === 0}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton class="cursor-default text-sidebar-foreground/50">
          <CircleIcon class="size-3 opacity-50" />
          <span class="text-xs italic">No sections yet</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {:else}
      {#each sections as section (section?._id)}
        {#if section}
          {@const activitiesQuery = useQuery(api.activities.listBySection, () => ({ sectionId: section._id }))}
          {@const now = Date.now()}
          {@const activeActivities = (activitiesQuery.data ?? []).filter((a) => a.startTime <= now && now <= a.endTime)}

          <Collapsible.Root class="group/collapsible">
            {#snippet child({ props })}
              <Sidebar.MenuItem {...props}>
                <Collapsible.Trigger>
                  {#snippet child({ props })}
                    <Sidebar.MenuButton {...props} tooltipContent={section.name}>
                      <FolderOpenIcon class="size-4 shrink-0" />
                      <a
                        href="/sections/{section._id}"
                        class="flex-1 truncate hover:underline"
                        onclick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          goto(`/sections/${section._id}`);
                        }}
                      >
                        {section.name}
                      </a>
                      {#if activeActivities.length > 0}
                        <span
                          class="mr-1 ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-[10px] font-medium text-sidebar-primary"
                        >
                          {activeActivities.length}
                        </span>
                      {/if}
                      <ChevronRightIcon
                        class="shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      />
                    </Sidebar.MenuButton>
                  {/snippet}
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Sidebar.MenuSub>
                    {#if session.role === 'teacher'}
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton>
                          {#snippet child({ props })}
                            <a href="/sections/{section._id}/cctv" {...props}>
                              <CctvIcon class="size-3.5 shrink-0 text-sidebar-foreground/60" />
                              <span class="truncate text-xs font-semibold text-sidebar-foreground/60">CCTV Hub</span>
                            </a>
                          {/snippet}
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    {/if}

                    {#if activeActivities.length === 0}
                      <Sidebar.MenuSubItem>
                        <Sidebar.MenuSubButton>
                          <span class="text-xs text-sidebar-foreground/50 italic"> No active activities </span>
                        </Sidebar.MenuSubButton>
                      </Sidebar.MenuSubItem>
                    {:else}
                      <div
                        class="mt-2 border-t border-border/20 px-2 py-1 pt-2 text-[10px] font-bold tracking-wider text-sidebar-foreground/40 uppercase"
                      >
                        Active Activities
                      </div>

                      {#each activeActivities as activity (activity._id)}
                        {@const problemsQuery = useQuery(api.activities.listProblems, () =>
                          session.role === 'student' ? { activityId: activity._id } : 'skip',
                        )}
                        {@const problems = problemsQuery.data ?? []}

                        <div class="px-2 py-1 text-xs font-semibold text-sidebar-foreground/70">
                          {activity.title}
                        </div>

                        {#if session.role === 'student'}
                          {#each problems as p (p._id)}
                            {#if p.problem}
                              <Sidebar.MenuSubItem>
                                <Sidebar.MenuSubButton>
                                  {#snippet child({ props })}
                                    <a href="/activities/{activity._id}/{p.problem!._id}" {...props}>
                                      <BookOpenCheckIcon class="size-3.5 shrink-0" />
                                      <span class="truncate">{p.problem!.title}</span>
                                    </a>
                                  {/snippet}
                                </Sidebar.MenuSubButton>
                              </Sidebar.MenuSubItem>
                            {/if}
                          {/each}
                        {/if}

                        {#if session.role === 'teacher'}
                          <Sidebar.MenuSubItem>
                            <Sidebar.MenuSubButton>
                              {#snippet child({ props })}
                                <a href="/activities/{activity._id}" {...props}>
                                  <ActivityIcon class="size-3 shrink-0 text-sidebar-foreground/60" />
                                  <span class="truncate text-xs text-sidebar-foreground/60"> Status </span>
                                </a>
                              {/snippet}
                            </Sidebar.MenuSubButton>
                          </Sidebar.MenuSubItem>
                          <Sidebar.MenuSubItem>
                            <Sidebar.MenuSubButton>
                              {#snippet child({ props })}
                                <a href="/activities/{activity._id}/playback" {...props}>
                                  <PlayCircleIcon class="size-3 shrink-0 text-sidebar-foreground/60" />
                                  <span class="truncate text-xs text-sidebar-foreground/60"> Playback </span>
                                </a>
                              {/snippet}
                            </Sidebar.MenuSubButton>
                          </Sidebar.MenuSubItem>
                          <Sidebar.MenuSubItem>
                            <Sidebar.MenuSubButton>
                              {#snippet child({ props })}
                                <a href="/activities/{activity._id}/edit" {...props}>
                                  <PencilIcon class="size-3 shrink-0 text-sidebar-foreground/60" />
                                  <span class="truncate text-xs text-sidebar-foreground/60"> Edit </span>
                                </a>
                              {/snippet}
                            </Sidebar.MenuSubButton>
                          </Sidebar.MenuSubItem>
                        {/if}
                      {/each}
                    {/if}
                  </Sidebar.MenuSub>
                </Collapsible.Content>
              </Sidebar.MenuItem>
            {/snippet}
          </Collapsible.Root>
        {/if}
      {/each}
    {/if}
  </Sidebar.Menu>
</Sidebar.Group>

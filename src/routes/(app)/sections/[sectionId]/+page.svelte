<script lang="ts">
  import Calendar from '@lucide/svelte/icons/calendar';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Clock from '@lucide/svelte/icons/clock';
  import Download from '@lucide/svelte/icons/download';
  import File from '@lucide/svelte/icons/file';
  import Folder from '@lucide/svelte/icons/folder';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import UploadCloud from '@lucide/svelte/icons/upload-cloud';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import DOMPurify from 'isomorphic-dompurify';
  import { toast } from 'svelte-sonner';

  import { page } from '$app/state';
  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel.js';

  import FileIcon from '$lib/components/FileIcon.svelte';
  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';

  const sectionId = $derived(page.params.sectionId as Id<'sections'>);
  const userId = $derived($session?.userId);
  const userRole = $derived($session?.role);

  // --- Real-time Convex Queries ---
  const sectionQuery = useQuery(api.sections.get, () => ({ id: sectionId }));
  const teachersQuery = useQuery(api.sections.listTeachers, () => ({ sectionId }));
  const studentsQuery = useQuery(api.sections.listStudents, () => ({ sectionId }));
  const activitiesQuery = useQuery(api.activities.listBySection, () => ({ sectionId }));

  // --- Derived states ---
  const section = $derived(sectionQuery.data);
  const teachers = $derived((teachersQuery.data || []).filter((t): t is NonNullable<typeof t> => t !== null));
  const students = $derived((studentsQuery.data || []).filter((s): s is NonNullable<typeof s> => s !== null));
  const activities = $derived((activitiesQuery.data || []).filter((a): a is NonNullable<typeof a> => a !== null));

  const isTeacher = $derived(teachers.some((t: any) => t._id === userId));
  const isStudent = $derived(students.some((s: any) => s._id === userId));
  const isAuthorized = $derived(userRole === 'admin' || isTeacher || isStudent);

  const isLoading = $derived(
    sectionQuery.isLoading || teachersQuery.isLoading || studentsQuery.isLoading || activitiesQuery.isLoading,
  );

  // --- Layout Helpers ---
  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function formatTime(timestamp: number) {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // --- Files & Resources Logic ---
  const client = useConvexClient();
  const resourcesQuery = useQuery(api.sectionResources.list, () => ({ sectionId }));
  const resources = $derived(resourcesQuery.data || []);

  let isUploading = $state(false);
  let uploadFolderName = $state('');
  let fileInputRef = $state<HTMLInputElement | null>(null);

  // Group resources by their folder/group
  const groupedResources = $derived.by(() => {
    const groups: Record<string, typeof resources> = {};
    for (const r of resources) {
      const gName = r.group || '';
      if (!groups[gName]) {
        groups[gName] = [];
      }
      groups[gName].push(r);
    }
    return groups;
  });

  let collapsedFolders = $state<Record<string, boolean>>({});

  function toggleFolder(folderName: string) {
    collapsedFolders[folderName] = !collapsedFolders[folderName];
  }

  function formatBytes(bytes: number | undefined) {
    if (bytes === undefined) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const files = Array.from(target.files);

    const MAX_SIZE = 50 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.warning(`File "${file.name}" is over 50MB and was skipped.`);
        continue;
      }
    }

    isUploading = true;
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const uploadUrl = await client.mutation(api.uploadedImages.generateUploadUrl, {});
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });

        if (!response.ok) throw new Error(`Upload failed for ${file.name}`);

        const result = await response.json();
        const storageId = result.storageId as Id<'_storage'>;

        await client.mutation(api.sectionResources.create, {
          sectionId,
          storageId,
          title: file.name,
          group: uploadFolderName.trim() || undefined,
          uploadedBy: userId as Id<'users'>,
        });
        uploadedCount++;
      }

      toast.success(
        files.length === 1 ? 'File uploaded successfully!' : `Successfully uploaded ${uploadedCount} files!`,
        { description: uploadFolderName.trim() ? `Added to "${uploadFolderName.trim()}" folder.` : undefined },
      );
      if (fileInputRef) fileInputRef.value = '';
    } catch (_err) {
      toast.error(`Uploaded ${uploadedCount}/${files.length} files. An error occurred.`);
    } finally {
      isUploading = false;
    }
  }

  let deleteDialogOpen = $state(false);
  let resourceToDelete = $state<Id<'sectionResources'> | null>(null);

  function triggerDelete(resourceId: Id<'sectionResources'>) {
    resourceToDelete = resourceId;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!resourceToDelete) return;
    try {
      await client.mutation(api.sectionResources.remove, {
        id: resourceToDelete,
        userId: userId as Id<'users'>,
      });
      toast.success('Resource deleted successfully.');
    } catch (_err) {
      toast.error('Failed to delete resource.');
    } finally {
      deleteDialogOpen = false;
      resourceToDelete = null;
    }
  }
</script>

<PageLayout>
  {#if isLoading}
    <div class="flex flex-col gap-6">
      <Card.Root class="overflow-hidden border border-border bg-card">
        <Card.Header class="gap-2">
          <Skeleton class="h-8 w-1/3" />
          <Skeleton class="h-4 w-1/2" />
        </Card.Header>
        <Card.Content class="gap-4">
          <div class="space-y-2">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-5/6" />
            <Skeleton class="h-4 w-4/5" />
            <Skeleton class="h-4 w-3/4" />
          </div>
        </Card.Content>
      </Card.Root>
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Skeleton class="h-4 w-28" />
        </Card.Header>
        <Card.Content class="grid gap-4 sm:grid-cols-3">
          <div class="flex items-center justify-between pb-3 sm:border-r sm:border-b-0 sm:pr-4 sm:pb-0">
            <Skeleton class="h-3 w-24" />
            <Skeleton class="h-4 w-8" />
          </div>
          <div class="flex items-center justify-between pb-3 sm:border-r sm:border-b-0 sm:px-4 sm:pb-0">
            <Skeleton class="h-3 w-28" />
            <Skeleton class="h-4 w-8" />
          </div>
          <div class="flex items-center justify-between sm:pl-4">
            <Skeleton class="h-3 w-20" />
            <Skeleton class="h-4 w-24" />
          </div>
        </Card.Content>
      </Card.Root>
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="flex flex-row items-center justify-between pb-3">
          <Skeleton class="h-4 w-40" />
        </Card.Header>
        <Card.Content class="space-y-3">
          {#each [1, 2] as i (i)}
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="flex items-center gap-3">
                <Skeleton class="h-8 w-8 rounded-full" />
                <div class="flex-1 space-y-1">
                  <Skeleton class="h-4 w-48" />
                  <Skeleton class="h-3 w-36" />
                </div>
                <Skeleton class="h-6 w-14 rounded-md" />
              </div>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Skeleton class="h-4 w-36" />
        </Card.Header>
        <Card.Content class="space-y-2">
          {#each [1, 2] as i (i)}
            <div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <Skeleton class="h-9 w-9 rounded-full" />
              <div class="flex-1 space-y-1">
                <Skeleton class="h-3.5 w-32" />
                <Skeleton class="h-3 w-48" />
              </div>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Skeleton class="h-4 w-40" />
        </Card.Header>
        <Card.Content class="space-y-2">
          {#each [1, 2, 3] as i (i)}
            <div class="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <Skeleton class="h-9 w-9 rounded-full" />
              <div class="flex-1 space-y-1">
                <Skeleton class="h-3.5 w-28" />
                <Skeleton class="h-3 w-44" />
              </div>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>
    </div>
  {:else if !section}
    <Card.Root class="border-border bg-card p-8 text-center shadow-xs">
      <Card.Header>
        <Card.Title class="text-md font-bold text-foreground">Section Not Found</Card.Title>
        <Card.Description class="text-xs text-muted-foreground"
          >The section you are trying to view does not exist.</Card.Description
        >
      </Card.Header>
      <Card.Content class="pt-4">
        <Button href="/sections" variant="outline" class="border-border text-xs font-semibold">
          Return to Sections
        </Button>
      </Card.Content>
    </Card.Root>
  {:else if !isAuthorized}
    <Card.Root class="border-destructive bg-destructive/5 p-8 text-center">
      <Card.Header>
        <Card.Title class="text-md font-bold text-destructive">Access Restricted</Card.Title>
        <Card.Description class="text-xs text-muted-foreground"
          >You are not enrolled or assigned to this academic section.</Card.Description
        >
      </Card.Header>
      <Card.Content class="pt-4">
        <Button href="/sections" variant="outline" class="border-border text-xs font-semibold">
          Return to Sections
        </Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Section Header Summary -->
    <PageHero title={section.name} description="Academic portal for class schedules, exams, and memberships.">
      {#snippet actions()}
        {#if userRole === 'admin'}
          <Button href="/sections/{section._id}/edit" variant="outline" size="lg" class="font-semibold">
            <Pencil class="size-4" />
            Manage Settings
          </Button>
        {/if}
      {/snippet}
    </PageHero>

    <!-- Layout Cards Stacked Vertically -->
    <div class="flex flex-col gap-6">
      <!-- Syllabus Card -->
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Card.Title class="text-sm font-bold tracking-wider text-muted-foreground uppercase"
            >Syllabus & Overview</Card.Title
          >
        </Card.Header>
        <Card.Content>
          {#if section.aboutMd}
            <div class="prose prose-sm max-w-none text-xs leading-relaxed text-muted-foreground dark:prose-invert">
              <!-- Render structured content safely -->
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html DOMPurify.sanitize(section.aboutMd)}
            </div>
          {:else}
            <p class="text-xs text-muted-foreground italic">No syllabus description is available for this section.</p>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Section Stats Card -->
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Card.Title class="text-sm font-bold tracking-wider text-muted-foreground uppercase">Section Stats</Card.Title
          >
        </Card.Header>
        <Card.Content class="grid gap-4 sm:grid-cols-3">
          <div
            class="flex items-center justify-between border-b border-border/30 pb-3 text-xs sm:border-r sm:border-b-0 sm:pr-4 sm:pb-0"
          >
            <span class="font-semibold text-muted-foreground">Total Students</span>
            <span class="text-sm font-bold text-foreground">{students.length}</span>
          </div>
          <div
            class="flex items-center justify-between border-b border-border/30 pb-3 text-xs sm:border-r sm:border-b-0 sm:px-4 sm:pb-0"
          >
            <span class="font-semibold text-muted-foreground">Active Activities</span>
            <span class="text-sm font-bold text-foreground">{activities.length}</span>
          </div>
          <div class="flex items-center justify-between text-xs sm:pl-4">
            <span class="font-semibold text-muted-foreground">Created At</span>
            <span class="text-sm font-bold text-foreground">{formatDate(section.createdAt)}</span>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Activities & Exams Card -->
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="flex flex-row items-center justify-between pb-3">
          <Card.Title class="text-sm font-bold tracking-wider text-muted-foreground uppercase"
            >Activities & Exams ({activities.length})</Card.Title
          >
          <!-- Create Action for teachers only -->
          {#if isTeacher}
            <Button href="/activities/new?sectionId={section._id}" size="lg" class="font-semibold">
              <Plus class="size-3.5" />
              New Activity
            </Button>
          {/if}
        </Card.Header>
        <Card.Content class="space-y-4">
          {#if activities.length === 0}
            <div
              class="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-6 text-center"
            >
              <Calendar class="h-7 w-7 text-muted-foreground/60" />
              <h4 class="mt-2 text-xs font-bold text-foreground">No Activities Scheduled</h4>
              <p class="mt-1 max-w-xs text-[11px] text-muted-foreground">
                There are no exams or classes currently scheduled for this section.
              </p>
            </div>
          {:else}
            <div class="grid gap-3">
              {#each activities as activity (activity._id)}
                <Card.Root class="border-border bg-card transition-all duration-200 hover:bg-muted/5">
                  <Card.Content class="flex flex-col p-4">
                    <div class="flex w-full items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="rounded-full bg-primary/5 p-2 text-primary">
                          <Clock class="h-4 w-4" />
                        </div>
                        <div>
                          <h4 class="text-xs font-bold text-foreground">{activity.title}</h4>
                          <div class="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span class="flex items-center gap-1">
                              <Calendar class="h-3 w-3" />
                              {formatDate(activity.startTime)}
                            </span>
                            <span>•</span>
                            <span>
                              {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          class="border-border bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-muted-foreground uppercase"
                        >
                          {activity.type}
                        </Badge>
                        {#if userRole !== 'student'}
                          <Button href="/activities/{activity._id}" size="lg" class="font-semibold">Enter</Button>
                        {/if}
                      </div>
                    </div>

                    {#if userRole === 'student'}
                      {@const problemsQuery = useQuery(api.activities.listProblems, () => ({
                        activityId: activity._id,
                      }))}
                      {@const problems = problemsQuery.data ?? []}
                      {@const now = Date.now()}
                      {@const isActive = now >= activity.startTime && now <= activity.endTime}
                      {@const isUpcoming = now < activity.startTime}

                      {#if problemsQuery.isLoading}
                        <div class="mt-3 flex flex-col gap-2 border-t border-border/30 px-2 pt-3">
                          {#each [1, 2] as i (i)}
                            <Skeleton class="h-10 w-full rounded-lg" />
                          {/each}
                        </div>
                      {:else if problems.length === 0}
                        <div
                          class="mt-3 flex items-center justify-center rounded-md border-t border-border/30 bg-muted/5 py-2 pt-3"
                        >
                          <span class="text-[10px] text-muted-foreground italic"
                            >No tasks assigned for this activity yet.</span
                          >
                        </div>
                      {:else}
                        <div class="mt-3 space-y-2 border-t border-border/30 pt-3">
                          <div class="text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase">
                            Assigned Tasks ({problems.length})
                          </div>
                          <div class="grid gap-2">
                            {#each problems as p (p._id)}
                              {#if p.problem}
                                <div
                                  class="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 p-2.5"
                                >
                                  <div class="flex items-center gap-2">
                                    <span
                                      class="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary"
                                    >
                                      {p.problemOrder + 1}
                                    </span>
                                    <span class="text-xs font-semibold text-foreground">{p.problem.title}</span>
                                  </div>
                                  <div>
                                    {#if isActive}
                                      <Button
                                        href="/activities/{activity._id}/{p.problem._id}"
                                        size="sm"
                                        class="font-bold"
                                      >
                                        Enter Assignment Room
                                      </Button>
                                    {:else if isUpcoming}
                                      <Badge
                                        variant="outline"
                                        class="border-info/25 bg-info/5 text-[9px] font-bold tracking-wider text-info uppercase"
                                      >
                                        Upcoming
                                      </Badge>
                                    {:else}
                                      <Badge
                                        variant="outline"
                                        class="border-border bg-muted/20 text-[9px] font-bold tracking-wider text-muted-foreground uppercase"
                                      >
                                        Closed
                                      </Badge>
                                    {/if}
                                  </div>
                                </div>
                              {/if}
                            {/each}
                          </div>
                        </div>
                      {/if}
                    {/if}
                  </Card.Content>
                </Card.Root>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Files & Resources Card -->
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="flex flex-row items-center justify-between pb-3">
          <div class="space-y-0.5">
            <Card.Title class="text-sm font-bold tracking-wider text-muted-foreground uppercase">
              Files & Resources
            </Card.Title>
            <Card.Description class="text-[11px] text-muted-foreground">
              Shared syllabus materials, study guides, and lecture files.
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content class="space-y-6">
          <!-- Upload form for teachers/admins -->
          {#if isTeacher || userRole === 'admin'}
            <div class="rounded-lg border border-dashed border-border bg-muted/10 p-4 transition-all hover:bg-muted/15">
              <h4 class="mb-3 flex items-center gap-1.5 text-xs font-bold text-foreground">
                <UploadCloud class="h-4 w-4 text-primary" />
                Upload Resources
              </h4>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <label for="res-group" class="text-[10px] font-bold text-muted-foreground uppercase">Folder</label>
                  <input
                    id="res-group"
                    type="text"
                    placeholder="Folder name (Optional)..."
                    bind:value={uploadFolderName}
                    class="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:outline-none"
                  />
                </div>

                <div class="flex flex-col justify-end gap-1.5">
                  <span class="invisible text-[10px] font-bold text-muted-foreground uppercase sm:block">Files</span>
                  <input
                    type="file"
                    class="hidden"
                    multiple
                    bind:this={fileInputRef}
                    onchange={handleFileUpload}
                    disabled={isUploading}
                  />
                  <Button onclick={() => fileInputRef?.click()} disabled={isUploading} size="lg" class="font-semibold">
                    {#if isUploading}
                      <Spinner class="mr-1.5 size-3.5" />
                      Uploading Files...
                    {:else}
                      <UploadCloud class="mr-1.5 size-3.5" />
                      Select & Upload Files
                    {/if}
                  </Button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Files Tree View -->
          {#if resourcesQuery.isLoading}
            <div class="space-y-2">
              <Skeleton class="h-10 w-full" />
              <Skeleton class="h-10 w-full" />
            </div>
          {:else if resources.length === 0}
            <div
              class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center"
            >
              <File class="h-8 w-8 text-muted-foreground/60" />
              <h4 class="mt-2 text-xs font-bold text-foreground">No resources uploaded</h4>
              <p class="mt-1 max-w-xs text-[11px] text-muted-foreground">
                There are no resource files available for this section yet.
              </p>
            </div>
          {:else}
            <!-- Render grouped resource folders -->
            <div class="space-y-4">
              <!-- We render folder groups first, and then top-level files (empty group "") -->
              {#each Object.keys(groupedResources).sort((a, b) => {
                if (a === '') return 1;
                if (b === '') return -1;
                return a.localeCompare(b);
              }) as groupName (groupName)}
                {@const groupFiles = groupedResources[groupName]}
                {#if groupFiles.length > 0}
                  {#if groupName !== ''}
                    <!-- Folder Group -->
                    {@const isCollapsed = collapsedFolders[groupName] || false}
                    <div class="overflow-hidden rounded-lg border border-border bg-card">
                      <!-- Folder Header (Collapsible toggle & upload button) -->
                      <div
                        class="flex w-full items-center justify-between bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/30"
                      >
                        <button
                          type="button"
                          onclick={() => toggleFolder(groupName)}
                          class="flex flex-1 items-center gap-2 text-xs font-bold text-foreground focus:outline-none"
                        >
                          {#if isCollapsed}
                            <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
                            <Folder class="h-4 w-4 shrink-0 fill-amber-500/20 text-amber-500" />
                          {:else}
                            <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
                            <FolderOpen class="h-4 w-4 shrink-0 fill-amber-500/20 text-amber-500" />
                          {/if}
                          <span>{groupName}</span>
                          <span
                            class="shrink-0 rounded-full bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {groupFiles.length}
                          </span>
                        </button>

                        {#if isTeacher || userRole === 'admin'}
                          <Button
                            onclick={(e) => {
                              e.stopPropagation();
                              uploadFolderName = groupName;
                              fileInputRef?.click();
                            }}
                            variant="ghost"
                            size="sm"
                            class="text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Upload files to this folder"
                          >
                            <UploadCloud class="size-3" />
                            Upload Here
                          </Button>
                        {/if}
                      </div>

                      <!-- Folder Content (Files list) -->
                      {#if !isCollapsed}
                        <div class="divide-y divide-border/40 bg-card px-2 py-1">
                          {#each groupFiles as file (file._id)}
                            <div class="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/10">
                              <div class="flex min-w-0 flex-1 items-center gap-2.5 pr-4">
                                <FileIcon title={file.title} />
                                <div class="min-w-0 flex-1">
                                  <h5 class="truncate text-xs font-semibold text-foreground" title={file.title}>
                                    {file.title}
                                  </h5>
                                  <p
                                    class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground"
                                  >
                                    <span>{formatBytes(file.size)}</span>
                                    <span>•</span>
                                    <span>By {file.uploaderName}</span>
                                    <span>•</span>
                                    <span>{formatDate(file.createdAt)}</span>
                                  </p>
                                </div>
                              </div>
                              <div class="flex shrink-0 items-center gap-1.5">
                                {#if file.downloadUrl}
                                  <Button
                                    href={file.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="ghost"
                                    size="icon"
                                    class="text-muted-foreground hover:bg-muted hover:text-foreground"
                                    title="Download File"
                                  >
                                    <Download class="size-4" />
                                  </Button>
                                {/if}
                                {#if isTeacher || userRole === 'admin'}
                                  <Button
                                    onclick={() => triggerDelete(file._id)}
                                    variant="ghost"
                                    size="icon"
                                    class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    title="Delete File"
                                  >
                                    <Trash2 class="size-4" />
                                  </Button>
                                {/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    <!-- Root Level Files -->
                    <div class="space-y-1">
                      <div class="mb-1.5 px-1 text-[10px] font-bold text-muted-foreground/70 uppercase">
                        General Files
                      </div>
                      <div class="divide-y divide-border/40 overflow-hidden rounded-lg border border-border bg-card">
                        {#each groupFiles as file (file._id)}
                          <div class="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/10">
                            <div class="flex min-w-0 flex-1 items-center gap-2.5 pr-4">
                              <FileIcon title={file.title} />
                              <div class="min-w-0 flex-1">
                                <h5 class="truncate text-xs font-semibold text-foreground" title={file.title}>
                                  {file.title}
                                </h5>
                                <p class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>{formatBytes(file.size)}</span>
                                  <span>•</span>
                                  <span>By {file.uploaderName}</span>
                                  <span>•</span>
                                  <span>{formatDate(file.createdAt)}</span>
                                </p>
                              </div>
                            </div>
                            <div class="flex shrink-0 items-center gap-1.5">
                              {#if file.downloadUrl}
                                <Button
                                  href={file.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  variant="ghost"
                                  size="icon"
                                  class="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Download File"
                                >
                                  <Download class="h-4 w-4" />
                                </Button>
                              {/if}
                              {#if isTeacher || userRole === 'admin'}
                                <Button
                                  onclick={() => triggerDelete(file._id)}
                                  variant="ghost"
                                  size="icon"
                                  class="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title="Delete File"
                                >
                                  <Trash2 class="h-4 w-4" />
                                </Button>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/if}
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Assigned Faculty Card -->
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Card.Title class="text-sm font-bold tracking-wider text-muted-foreground uppercase"
            >Assigned Faculty ({teachers.length})</Card.Title
          >
        </Card.Header>
        <Card.Content>
          {#if teachers.length === 0}
            <p class="text-xs text-muted-foreground italic">No instructors assigned yet.</p>
          {:else}
            <div class="grid gap-3 sm:grid-cols-2">
              {#each teachers as teacher (teacher._id)}
                <a
                  href="/users/{teacher._id}"
                  class="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-all duration-200 hover:border-primary/30 hover:bg-muted/50"
                >
                  <Avatar.Root class="h-9 w-9 border border-border">
                    <Avatar.Image src={teacher.avatarUrl} alt={teacher.name} />
                    <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                      {teacher.name.substring(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div>
                    <h4 class="text-xs font-bold text-foreground hover:underline">{teacher.name}</h4>
                    <p class="text-[10px] text-muted-foreground">{teacher.email}</p>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Students Card -->
      <Card.Root class="border-border bg-card shadow-xs">
        <Card.Header class="pb-3">
          <Card.Title class="text-sm font-bold tracking-wider text-muted-foreground uppercase"
            >Enrolled Students ({students.length})</Card.Title
          >
        </Card.Header>
        <Card.Content>
          {#if students.length === 0}
            <p class="text-xs text-muted-foreground italic">No students currently enrolled.</p>
          {:else}
            <div class="grid gap-3 sm:grid-cols-2">
              {#each students as student (student._id)}
                <a
                  href="/users/{student._id}"
                  class="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-all duration-200 hover:border-primary/30 hover:bg-muted/50"
                >
                  <Avatar.Root class="h-9 w-9 border border-border">
                    <Avatar.Image src={student.avatarUrl} alt={student.name} />
                    <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                      {student.name.substring(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div>
                    <h4 class="text-xs font-bold text-foreground hover:underline">{student.name}</h4>
                    <p class="text-[10px] text-muted-foreground">{student.email}</p>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</PageLayout>

<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content class="border border-border bg-card">
    <AlertDialog.Header>
      <AlertDialog.Title class="text-md font-bold text-foreground">Delete Resource</AlertDialog.Title>
      <AlertDialog.Description class="text-xs text-muted-foreground">
        Are you sure you want to delete this resource? This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer class="gap-2">
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={confirmDelete}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import User from '@lucide/svelte/icons/user';
  import UserCheck from '@lucide/svelte/icons/user-check';
  import Users from '@lucide/svelte/icons/users';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { toast } from 'svelte-sonner';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import Tiptap from '$lib/components/editor/Tiptap.svelte';
  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import * as Avatar from '$lib/components/ui/avatar/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session } from '$lib/session';

  const client = useConvexClient();
  const userRole = $derived($session?.role);

  // --- Real-time Convex Queries ---
  const usersQuery = useQuery(api.users.list, () => (userRole === 'admin' ? {} : 'skip'));
  const users = $derived(usersQuery.data || []);
  const teachers = $derived(users.filter((u) => u.role === 'teacher'));

  let name = $state('');
  let aboutMd = $state('');
  let teacherId = $state('');
  let selectedStudentIds = $state<string[]>([]);

  // Search queries
  let teacherSearchQuery = $state('');
  let studentSearchQuery = $state('');

  // Derived filtered lists
  const availableTeachers = $derived(
    teachers.filter(
      (t) =>
        t._id !== teacherId &&
        (t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()) ||
          t.email.toLowerCase().includes(teacherSearchQuery.toLowerCase())),
    ),
  );

  const selectedTeacher = $derived(teachers.find((t) => t._id === teacherId));

  const enrolledStudents = $derived(users.filter((u) => u.role === 'student' && selectedStudentIds.includes(u._id)));

  const availableStudents = $derived(
    users.filter(
      (u) =>
        u.role === 'student' &&
        !selectedStudentIds.includes(u._id) &&
        (u.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(studentSearchQuery.toLowerCase())),
    ),
  );

  let isSubmitting = $state(false);

  async function handleCreateSection() {
    if (!name.trim()) {
      toast.error('Section name is required.');
      return;
    }
    if (!teacherId) {
      toast.error('Please assign an instructor to this section.');
      return;
    }
    isSubmitting = true;
    try {
      // 1. Create the section
      const sectionId = await client.mutation(api.sections.create, {
        name: name.trim(),
        aboutMd: aboutMd.trim() || undefined,
      });

      // 2. Assign the teacher directly
      await client.mutation(api.sections.addTeacher, {
        sectionId,
        teacherId: teacherId as any,
      });

      // 3. Enroll selected students
      for (const sId of selectedStudentIds) {
        await client.mutation(api.sections.addStudent, {
          sectionId,
          studentId: sId as any,
        });
      }

      toast.success('Section created, instructor assigned, and student roster enrolled successfully!', {
        description: `"${name.trim()}" is now ready for activities and resources.`,
      });
      goto(`/sections/${sectionId}`);
    } catch (_e) {
      toast.error('Failed to create section.');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<PageLayout>
  {#if userRole !== 'admin'}
    <!-- Unauthorized Access Protection -->
    <Card.Root class="border-destructive bg-destructive/5 p-8 text-center">
      <Card.Header>
        <Card.Title class="text-md font-bold text-destructive">Unauthorized Access</Card.Title>
        <Card.Description class="text-xs text-muted-foreground"
          >Only administrators are authorized to create new sections.</Card.Description
        >
      </Card.Header>
      <Card.Content class="pt-4">
        <Button href="/sections" variant="outline" class="border-border text-xs font-semibold">
          Return to Sections List
        </Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Section Creation Form -->
    <div class="flex flex-col gap-8">
      <!-- 1. Metadata -->
      <PageHero
        title="Create New Section"
        description="Define a new academic course, assign its instructor directly, and initialize class syllabus."
      />
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Content class="flex flex-col gap-6 p-6">
          <!-- Section Name -->
          <div class="flex flex-col gap-2">
            <Label for="section-name" class="text-xs font-semibold">
              Section / Course Title <span class="text-destructive">*</span>
            </Label>
            <Input
              id="section-name"
              placeholder="e.g. CSE 1115: Object Oriented Programming"
              class="py-4 text-xs focus-visible:ring-primary/20"
              bind:value={name}
              disabled={isSubmitting}
            />
          </div>

          <!-- Syllabus -->
          <div class="flex flex-col gap-2">
            <Label class="text-xs font-semibold">Syllabus & Description</Label>
            <div class="rounded-md border border-border bg-card p-1">
              <Tiptap initialContent={aboutMd} onUpdate={(html: string) => (aboutMd = html)} />
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- 2. Primary Instructor Selection -->
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Card.Title class="text-md flex items-center gap-2 font-bold tracking-tight text-foreground">
            <UserCheck class="h-5 w-5 text-primary" />
            Primary Instructor <span class="text-destructive">*</span>
          </Card.Title>
          <Card.Description class="text-xs text-muted-foreground">
            Search and assign the primary instructor for this section.
          </Card.Description>
        </Card.Header>
        <Card.Content class="grid gap-6 p-6">
          <!-- Selected Instructor -->
          <div class="space-y-2">
            <Label class="text-xs font-semibold">Selected Instructor</Label>
            {#if !selectedTeacher}
              <div
                class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/5 py-8 text-center"
              >
                <User class="mb-2 size-8 text-muted-foreground/30" />
                <p class="text-xs font-medium text-muted-foreground">No instructor assigned yet</p>
                <p class="text-[10px] text-muted-foreground/60">
                  Search and assign an instructor from the directory below.
                </p>
              </div>
            {:else}
              <div class="rounded-md border bg-background p-3">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    <Avatar.Root class="h-8 w-8 border border-border">
                      <Avatar.Image src={selectedTeacher.avatarUrl} alt={selectedTeacher.name} />
                      <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                        {selectedTeacher.name.substring(0, 2).toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <div>
                      <p class="text-xs font-semibold">{selectedTeacher.name}</p>
                      <p class="text-[10px] text-muted-foreground">{selectedTeacher.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onclick={() => (teacherId = '')}
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </div>
            {/if}
          </div>

          {#if !selectedTeacher}
            <Separator />

            <!-- Selection/Search list -->
            <div class="space-y-3">
              <div class="flex flex-col gap-2">
                <Label for="teacherSearch" class="text-xs font-semibold">Search Instructors</Label>
                <Input
                  id="teacherSearch"
                  placeholder="Search by name or email..."
                  bind:value={teacherSearchQuery}
                  class="h-9 text-xs"
                />
              </div>

              {#if usersQuery.isLoading}
                <Skeleton class="h-10 w-full" />
              {:else if availableTeachers.length === 0}
                <p class="py-4 text-center text-xs text-muted-foreground">No matching instructors found.</p>
              {:else}
                <div class="max-h-[200px] divide-y overflow-y-auto rounded-md border bg-background">
                  {#each availableTeachers as t (t._id)}
                    <div class="flex items-center justify-between gap-4 p-3 hover:bg-muted/10">
                      <div class="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar.Root class="h-8 w-8 border border-border">
                          <Avatar.Image src={t.avatarUrl} alt={t.name} />
                          <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                            {t.name.substring(0, 2).toUpperCase()}
                          </Avatar.Fallback>
                        </Avatar.Root>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-xs font-semibold">{t.name}</p>
                          <p class="truncate text-[10px] text-muted-foreground">{t.email}</p>
                        </div>
                      </div>
                      <Button size="sm" class="h-7 px-3 text-xs" variant="outline" onclick={() => (teacherId = t._id)}>
                        Assign
                      </Button>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- 3. Student Enrollment Selection -->
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Card.Title class="text-md flex items-center gap-2 font-bold tracking-tight text-foreground">
            <Users class="h-5 w-5 text-primary" />
            Student Enrollment Roster
          </Card.Title>
          <Card.Description class="text-xs text-muted-foreground">
            Search and enroll students into this section roster.
          </Card.Description>
        </Card.Header>
        <Card.Content class="grid gap-6 p-6">
          <!-- Selected Students -->
          <div class="space-y-2">
            <Label class="text-xs font-semibold">Selected Students ({enrolledStudents.length})</Label>
            {#if enrolledStudents.length === 0}
              <div
                class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/5 py-8 text-center"
              >
                <Users class="mb-2 size-8 text-muted-foreground/30" />
                <p class="text-xs font-medium text-muted-foreground">No students enrolled yet</p>
                <p class="text-[10px] text-muted-foreground/60">Search and add students from the directory below.</p>
              </div>
            {:else}
              <div class="max-h-[250px] divide-y overflow-y-auto rounded-md border bg-background">
                {#each enrolledStudents as s (s._id)}
                  <div class="flex items-center justify-between gap-4 p-3 hover:bg-muted/10">
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar.Root class="h-8 w-8 border border-border">
                        <Avatar.Image src={s.avatarUrl} alt={s.name} />
                        <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                          {s.name.substring(0, 2).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-xs font-semibold">{s.name}</p>
                        <p class="truncate text-[10px] text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onclick={() => (selectedStudentIds = selectedStudentIds.filter((id) => id !== s._id))}
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <Separator />

          <!-- Selection/Search list -->
          <div class="space-y-3">
            <div class="flex flex-col gap-2">
              <Label for="studentSearch" class="text-xs font-semibold">Search Students</Label>
              <Input
                id="studentSearch"
                placeholder="Search by name or email..."
                bind:value={studentSearchQuery}
                class="h-9 text-xs"
              />
            </div>

            {#if usersQuery.isLoading}
              <Skeleton class="h-10 w-full" />
            {:else if availableStudents.length === 0}
              <p class="py-4 text-center text-xs text-muted-foreground">No matching unassigned students found.</p>
            {:else}
              <div class="max-h-[250px] divide-y overflow-y-auto rounded-md border bg-background">
                {#each availableStudents as s (s._id)}
                  <div class="flex items-center justify-between gap-4 p-3 hover:bg-muted/10">
                    <div class="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar.Root class="h-8 w-8 border border-border">
                        <Avatar.Image src={s.avatarUrl} alt={s.name} />
                        <Avatar.Fallback class="bg-primary/5 text-xs font-bold text-primary">
                          {s.name.substring(0, 2).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar.Root>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-xs font-semibold">{s.name}</p>
                        <p class="truncate text-[10px] text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      class="h-7 px-3 text-xs"
                      onclick={() => selectedStudentIds.push(s._id)}
                    >
                      Add
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-end gap-3 border-t border-border/30 bg-muted/5 py-4">
        <Button
          href="/sections"
          variant="outline"
          class="h-9 border-border text-xs font-semibold"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onclick={handleCreateSection}
          class="h-9 bg-primary text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90"
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <Spinner class="mr-1.5 h-3.5 w-3.5" />
            Creating...
          {:else}
            <Plus class="mr-1.5 h-3.5 w-3.5" />
            Create Section
          {/if}
        </Button>
      </div>
    </div>
  {/if}
</PageLayout>

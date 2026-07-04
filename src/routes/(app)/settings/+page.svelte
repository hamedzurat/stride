<script lang="ts">
  import Camera from '@lucide/svelte/icons/camera';
  import Lock from '@lucide/svelte/icons/lock';
  import Mail from '@lucide/svelte/icons/mail';
  import Save from '@lucide/svelte/icons/save';
  import Shield from '@lucide/svelte/icons/shield';
  import ShieldAlert from '@lucide/svelte/icons/shield-alert';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import User from '@lucide/svelte/icons/user';
  import { useConvexClient, useQuery } from 'convex-svelte';
  import { toast } from 'svelte-sonner';
  import { fade } from 'svelte/transition';

  import { api } from '$convex/_generated/api.js';
  import type { Id } from '$convex/_generated/dataModel';

  import Tiptap from '$lib/components/editor/Tiptap.svelte';
  import { PageHero, PageLayout } from '$lib/components/page/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Separator } from '$lib/components/ui/separator/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import { session, setSession } from '$lib/session';
  import { cn } from '$lib/utils';

  const client = useConvexClient();

  // Load profile data reactively
  const profileQuery = useQuery(api.users.getProfileData, () => ({
    userId: $session?.userId as Id<'users'>,
  }));

  // Form State
  let name = $state('');
  let avatarUrl = $state('');
  let aboutMd = $state('');
  let initialized = $state(false);

  // Password State
  let newPassword = $state('');
  let confirmPassword = $state('');

  // Loading States
  let isSavingProfile = $state(false);
  let isUploadingAvatar = $state(false);
  let isUpdatingPassword = $state(false);

  // Hidden file input reference
  let fileInputRef = $state<HTMLInputElement | null>(null);

  // Password Strength & Entropy
  let timeToBreakText = $derived.by(() => {
    if (!newPassword) return '';
    let poolSize = 0;
    if (/[a-z]/.test(newPassword)) poolSize += 26;
    if (/[A-Z]/.test(newPassword)) poolSize += 26;
    if (/[0-9]/.test(newPassword)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(newPassword)) poolSize += 33;

    if (poolSize === 0) return '0 seconds';

    const entropy = newPassword.length * Math.log2(poolSize);
    const guesses = Math.pow(2, entropy);
    const guessesPerSecond = 1e10; // 10 billion guesses/sec
    const secondsToBreak = guesses / guessesPerSecond;
    const secondsInYear = 365.25 * 24 * 3600;
    const yearsToBreak = secondsToBreak / secondsInYear;

    if (yearsToBreak < 1 / (365.25 * 24 * 3600)) {
      return 'Instantly';
    } else if (yearsToBreak < 1 / 365.25) {
      const hours = secondsToBreak / 3600;
      if (hours < 1) {
        const mins = secondsToBreak / 60;
        return `${Math.max(1, Math.round(mins))} minute(s)`;
      }
      return `${Math.round(hours)} hour(s)`;
    } else if (yearsToBreak < 1) {
      const days = secondsToBreak / (24 * 3600);
      return `${Math.round(days)} day(s)`;
    } else if (yearsToBreak < 1000) {
      return `${Math.round(yearsToBreak).toLocaleString()} year(s)`;
    } else if (yearsToBreak < 1e6) {
      return `${Math.round(yearsToBreak / 1000).toLocaleString()} thousand years`;
    } else if (yearsToBreak < 1e9) {
      return `${Math.round(yearsToBreak / 1e6).toLocaleString()} million years`;
    } else {
      return `${Math.round(yearsToBreak / 1e9).toLocaleString()} billion years`;
    }
  });

  let passwordStrengthColor = $derived.by(() => {
    if (!newPassword) return '';
    let poolSize = 0;
    if (/[a-z]/.test(newPassword)) poolSize += 26;
    if (/[A-Z]/.test(newPassword)) poolSize += 26;
    if (/[0-9]/.test(newPassword)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(newPassword)) poolSize += 33;
    const entropy = newPassword.length * Math.log2(poolSize || 1);
    if (entropy < 40) return 'text-destructive';
    if (entropy < 60) return 'text-warning';
    return 'text-success';
  });

  // Populate form fields once profile loads
  $effect(() => {
    if (profileQuery.data && !initialized) {
      name = profileQuery.data.user.name;
      avatarUrl = profileQuery.data.user.avatarUrl || '';
      aboutMd = profileQuery.data.user.aboutMd || '';
      initialized = true;
    }
  });

  // Handle avatar selection and size checks (< 512KB)
  async function handleAvatarUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];

    // Check size limit: 512KB
    const MAX_SIZE = 512 * 1024;
    if (file.size > MAX_SIZE) {
      toast.warning('Profile picture must be less than 512KB to keep it lightweight.', {
        description: 'Please select a smaller image or compress the file.',
      });
      return;
    }

    isUploadingAvatar = true;
    try {
      // 1. Get Convex upload URL
      const uploadUrl = await client.mutation(api.uploadedImages.generateUploadUrl, {});

      // 2. Post file
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!response.ok) throw new Error('Failed to upload image to Convex storage.');

      const result = await response.json();
      const storageId = result.storageId as Id<'_storage'>;

      // Delete previous custom avatar storage files before registering the new one
      if ($session?.userId) {
        await client.mutation(api.uploadedImages.deletePreviousAvatars, {
          userId: $session.userId,
        });
      }

      // 3. Register image to uploadedImages
      if ($session?.userId) {
        await client.mutation(api.uploadedImages.registerUploadedImage, {
          storageId,
          authorId: $session.userId,
          isAvatar: true,
        });
      }

      // 4. Resolve signed URL
      const url = await client.query(api.uploadedImages.getImageUrl, { storageId });
      if (url) {
        avatarUrl = url;

        // Auto-save avatar to users database table immediately
        if ($session?.userId) {
          await client.mutation(api.users.updateProfile, {
            id: $session.userId,
            avatarUrl: url,
          });
          setSession({
            ...$session,
            avatarUrl: url,
          });
        }
        toast.success('Avatar uploaded and saved successfully!', {
          description: 'Your profile photo has been updated.',
        });
      } else {
        toast.error('Failed to resolve avatar image URL.');
      }
    } catch (_err) {
      toast.error('Failed to upload avatar.');
    } finally {
      isUploadingAvatar = false;
    }
  }

  async function generateRandomDiceBearAvatar() {
    if (!$session?.userId) return;
    const randSeed = Math.floor(Math.random() * 1000000).toString();
    const generatedUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${randSeed}`;

    isUploadingAvatar = true;
    try {
      // 1. Delete previous custom avatar uploaded files from storage
      await client.mutation(api.uploadedImages.deletePreviousAvatars, {
        userId: $session.userId,
      });

      // 2. Set new avatar state
      avatarUrl = generatedUrl;

      // 3. Save new avatar URL to user profile
      await client.mutation(api.users.updateProfile, {
        id: $session.userId,
        avatarUrl: generatedUrl,
      });

      // 4. Synchronize local session
      setSession({
        ...$session,
        avatarUrl: generatedUrl,
      });

      toast.success('Generated random avatar successfully!', {
        description: 'A new DiceBear avatar has been applied.',
      });
    } catch (_err) {
      toast.error('Failed to generate random avatar.');
    } finally {
      isUploadingAvatar = false;
    }
  }

  // Trigger hidden file browser
  function selectAvatarFile() {
    fileInputRef?.click();
  }

  // Submit Account Info Changes
  async function saveAccountInfo(e: Event) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    if (!$session?.userId) return;

    isSavingProfile = true;
    try {
      await client.mutation(api.users.updateProfile, {
        id: $session.userId,
        name: name.trim(),
      });

      // Update active session locally
      setSession({
        ...$session,
        name: name.trim(),
      });

      toast.success('Account name updated successfully.', {
        description: 'Your display name has been updated across the platform.',
      });
    } catch (_err) {
      toast.error('Failed to update name. Please try again.');
    } finally {
      isSavingProfile = false;
    }
  }

  // Submit Biography Changes
  let isSavingBiography = $state(false);
  async function saveBiography(e: Event) {
    e.preventDefault();
    if (!$session?.userId) return;

    isSavingBiography = true;
    try {
      await client.mutation(api.users.updateProfile, {
        id: $session.userId,
        aboutMd: aboutMd.trim(),
      });
      toast.success('Biography saved successfully.', {
        description: 'Your profile biography has been updated.',
      });
    } catch (_err) {
      toast.error('Failed to save biography. Please try again.');
    } finally {
      isSavingBiography = false;
    }
  }

  // Submit Avatar Changes
  async function saveAvatar(e: Event) {
    e.preventDefault();
    if (!$session?.userId) return;

    try {
      await client.mutation(api.users.updateProfile, {
        id: $session.userId,
        avatarUrl: avatarUrl ? avatarUrl.trim() : '',
      });

      // Update active session locally
      setSession({
        ...$session,
        avatarUrl: avatarUrl ? avatarUrl.trim() : null,
      });

      toast.success('Avatar photo saved successfully.', {
        description: 'Your avatar URL has been updated.',
      });
    } catch (_err) {
      toast.error('Failed to save avatar photo.');
    }
  }

  // Update Password
  async function updatePassword(e: Event) {
    e.preventDefault();
    if (!newPassword) return toast.error('Password cannot be empty.');
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match.');
    if (!$session?.userId) return;

    isUpdatingPassword = true;
    try {
      await client.mutation(api.users.updatePassword, {
        id: $session.userId,
        passwordHash: newPassword,
      });

      toast.success('Password updated successfully.', {
        description: 'You will need to use this new password on your next login.',
      });
      newPassword = '';
      confirmPassword = '';
    } catch (_err) {
      toast.error('Failed to update password.');
    } finally {
      isUpdatingPassword = false;
    }
  }
</script>

<PageLayout>
  <PageHero title="Account Settings" description="Manage your profile, avatar, biography, and password security." />

  {#if profileQuery.isLoading}
    <div class="flex flex-col gap-8">
      {#each [0, 1, 2] as i (i)}
        <Card.Root class="overflow-hidden border bg-card shadow-sm">
          <Card.Header class="p-6">
            <Skeleton class="h-5 w-36" />
            <Skeleton class="mt-1 h-3 w-48" />
          </Card.Header>
          <Separator />
          <Card.Content class="grid gap-4 p-6">
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {:else if profileQuery.data}
    <div class="flex flex-col gap-8">
      <!-- Hidden file input for avatar uploading -->
      <input type="file" accept="image/*" class="hidden" bind:this={fileInputRef} onchange={handleAvatarUpload} />

      <!-- 1. Account Identity Detail -->
      <form onsubmit={saveAccountInfo}>
        <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
          <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
            <Card.Title class="flex items-center gap-2 text-lg font-bold tracking-tight">
              <User class="h-5 w-5 text-primary" />
              Personal Profile
            </Card.Title>
            <Card.Description>Manage your name and view system access authorization.</Card.Description>
          </Card.Header>
          <Card.Content class="flex flex-col gap-6 p-6">
            <!-- Email (Read only) -->
            <div class="flex flex-col gap-2">
              <Label class="text-sm font-semibold text-muted-foreground">Email Address</Label>
              <div class="relative">
                <Input
                  type="email"
                  value={profileQuery.data.user.email}
                  disabled
                  class="cursor-not-allowed border-border/60 bg-muted/50 pl-10 text-muted-foreground"
                />
                <Mail class="absolute top-1/2 left-3.5 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/60" />
              </div>
              <p class="text-xs leading-relaxed text-muted-foreground">
                Your email is locked for system authentication. Contact an administrator to update.
              </p>
            </div>

            <!-- Role indicator -->
            <div class="flex flex-col gap-2">
              <Label class="text-sm font-semibold text-muted-foreground">System Role</Label>
              <div class="flex items-center gap-3">
                <Badge
                  class="px-3 py-1 text-xs font-bold tracking-wider uppercase"
                  variant={profileQuery.data.user.role === 'admin'
                    ? 'destructive'
                    : profileQuery.data.user.role === 'teacher'
                      ? 'outline'
                      : 'default'}
                >
                  <Shield class="mr-1.5 h-3.5 w-3.5" />
                  {profileQuery.data.user.role}
                </Badge>
              </div>
            </div>

            <!-- Name Input -->
            <div class="flex flex-col gap-2">
              <Label for="profile-name" class="text-sm font-semibold">Display Name</Label>
              <Input
                id="profile-name"
                placeholder="John Doe"
                bind:value={name}
                required
                maxlength={50}
                class="border-primary/20 py-5 text-sm focus-visible:ring-primary/30"
              />
            </div>
          </Card.Content>
          <Card.Footer class="flex justify-end border-t bg-muted/5 px-6 py-4">
            <Button type="submit" disabled={isSavingProfile} size="lg" class="font-semibold shadow-sm">
              {#if isSavingProfile}
                <Spinner class="size-4" />
                Saving...
              {:else}
                <Save class="size-4" />
                Save Account Info
              {/if}
            </Button>
          </Card.Footer>
        </Card.Root>
      </form>

      <!-- 2. Custom Avatar Photo -->
      <form onsubmit={saveAvatar}>
        <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
          <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
            <Card.Title class="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Camera class="h-5 w-5 text-primary" />
              Profile Photo
            </Card.Title>
            <Card.Description>Upload a custom picture. Keep it under 512KB for best loading speeds.</Card.Description>
          </Card.Header>
          <Card.Content class="flex flex-col items-center gap-6 p-6 md:flex-row md:gap-8">
            <!-- Avatar Display -->
            <div class="group relative select-none">
              <button
                type="button"
                onclick={selectAvatarFile}
                disabled={isUploadingAvatar}
                class="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/40 transition-all duration-200 group-hover:brightness-90 focus:outline-none"
              >
                {#if isUploadingAvatar}
                  <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70">
                    <Spinner class="size-6 text-primary" />
                  </div>
                {/if}

                {#if avatarUrl}
                  <img src={avatarUrl} alt={name || 'Avatar'} class="h-full.5 w-full object-cover" />
                {:else}
                  <span class="text-2xl font-bold tracking-tight text-muted-foreground uppercase">
                    {(name || 'U').substring(0, 2)}
                  </span>
                {/if}

                <!-- Camera hover overlay -->
                <div
                  class="absolute inset-0 flex items-center justify-center bg-pure-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  <Camera class="h-6 w-6 text-pure-white" />
                </div>
              </button>
            </div>

            <!-- Avatar details -->
            <div class="flex-1 space-y-3 text-center md:text-left">
              <h3 class="text-base font-bold">Customize Photo</h3>
              <p class="max-w-sm text-xs leading-relaxed text-muted-foreground">
                Supported formats: PNG, JPG, GIF. A square image of 256x256 pixels is ideal. Image uploads are cached in
                Convex storage.
              </p>
              <div class="flex flex-wrap justify-center gap-2 md:justify-start">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onclick={selectAvatarFile}
                  disabled={isUploadingAvatar}
                >
                  Browse File
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  class="gap-1.5"
                  onclick={generateRandomDiceBearAvatar}
                  disabled={isUploadingAvatar}
                >
                  <Sparkles class="h-4 w-4 text-primary" />
                  Generate Random Avatar
                </Button>

                {#if avatarUrl}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onclick={async () => {
                      if ($session?.userId) {
                        await client.mutation(api.uploadedImages.deletePreviousAvatars, {
                          userId: $session.userId,
                        });

                        // Revert to email seed default avatar URL
                        const email = profileQuery.data?.user.email || '';
                        const defaultUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(email)}`;

                        avatarUrl = defaultUrl;
                        await client.mutation(api.users.updateProfile, {
                          id: $session.userId,
                          avatarUrl: defaultUrl,
                        });
                        setSession({
                          ...$session,
                          avatarUrl: defaultUrl,
                        });
                      }
                      toast.info('Avatar reverted to default seed shape.', {
                        description: 'Your avatar has been reset to the email-based default.',
                      });
                    }}
                    disabled={isUploadingAvatar}
                  >
                    Remove Photo
                  </Button>
                {/if}
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      </form>

      <!-- 3. Biography (About Me) -->
      <form onsubmit={saveBiography}>
        <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
          <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
            <Card.Title class="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Sparkles class="h-5 w-5 text-primary" />
              Personal Biography
            </Card.Title>
            <Card.Description
              >Introduce yourself, share programming achievements, or post coding stats.</Card.Description
            >
          </Card.Header>
          <Card.Content class="p-6">
            {#if initialized}
              <Tiptap initialContent={aboutMd} onUpdate={(html: string) => (aboutMd = html)} />
            {/if}
          </Card.Content>
          <Card.Footer class="flex justify-end border-t bg-muted/5 px-6 py-4">
            <Button type="submit" disabled={isSavingBiography} size="lg" class="font-semibold shadow-sm">
              {#if isSavingBiography}
                <Spinner class="size-4" />
                Saving...
              {:else}
                <Save class="size-4" />
                Save Biography
              {/if}
            </Button>
          </Card.Footer>
        </Card.Root>
      </form>

      <!-- 4. ACCOUNT PASSWORD FORM CARD -->
      <Card.Root class="overflow-hidden border border-border bg-card shadow-sm">
        <Card.Header class="space-y-1.5 border-b bg-muted/10 p-6">
          <Card.Title class="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <Lock class="h-5 w-5 text-primary" />
            Security & Password
          </Card.Title>
          <Card.Description>Modify your account access passphrase.</Card.Description>
        </Card.Header>
        <Card.Content class="p-6">
          <form onsubmit={updatePassword} class="flex flex-col gap-6">
            <div class="grid gap-6 md:grid-cols-2">
              <!-- New password -->
              <div class="flex flex-col gap-2">
                <Label for="new-pw" class="text-sm font-semibold">New Password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  placeholder="••••••••"
                  bind:value={newPassword}
                  required
                  minlength={6}
                  class="border-primary/20 py-5 focus-visible:ring-primary/30"
                />
              </div>

              <!-- Confirm password -->
              <div class="flex flex-col gap-2">
                <Label for="confirm-pw" class="text-sm font-semibold">Confirm Password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  placeholder="••••••••"
                  bind:value={confirmPassword}
                  required
                  minlength={6}
                  class="border-primary/20 py-5 focus-visible:ring-primary/30"
                />
              </div>
            </div>

            <!-- Password strength estimation spanning full width -->
            {#if newPassword}
              <div class="space-y-1.5 rounded-lg border bg-muted/20 p-4" transition:fade={{ duration: 150 }}>
                <div class="flex items-center justify-between text-xs font-semibold">
                  <span>Time to break (estimated):</span>
                  <span class={passwordStrengthColor}>{timeToBreakText}</span>
                </div>
                <!-- Visual strength bar -->
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    class={cn(
                      'h-full transition-all duration-300',
                      passwordStrengthColor === 'text-destructive' && 'w-1/3 bg-destructive',
                      passwordStrengthColor === 'text-warning' && 'w-2/3 bg-warning',
                      passwordStrengthColor === 'text-success' && 'w-full bg-success',
                    )}
                  ></div>
                </div>
              </div>
            {/if}

            <!-- Password Info -->
            <div
              class="flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground"
            >
              <ShieldAlert class="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
              <div>
                <span class="font-bold text-foreground">Important:</span> Choose a secure, robust password. You will need
                to log back in using this new password on your next visit.
              </div>
            </div>

            <!-- Submit -->
            <div class="flex justify-end border-t pt-4">
              <Button type="submit" disabled={isUpdatingPassword} size="lg" class="font-semibold shadow-sm">
                {#if isUpdatingPassword}
                  <Spinner class="size-4" />
                  Updating...
                {:else}
                  <Lock class="size-4" />
                  Update Password
                {/if}
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</PageLayout>

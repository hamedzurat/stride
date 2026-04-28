<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import GlobeIcon from '@lucide/svelte/icons/globe';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SunIcon from '@lucide/svelte/icons/sun';
  import { useConvexClient } from 'convex-svelte';
  import { mode, toggleMode } from 'mode-watcher';
  import { z } from 'zod';

  import { goto } from '$app/navigation';
  import { api } from '$convex/_generated/api.js';

  import loginImage from '$lib/assets/login-image.jpg?enhanced';
  import Blurhash from '$lib/components/ui/blurhash.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { Field, FieldDescription, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Spinner } from '$lib/components/ui/spinner/index.js';
  import Translation from '$lib/components/ui/translation.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { setSession } from '$lib/session';

  import credentialsData from './credentials.json';

  const loginImageBlurhash = 'UFGl6K_2tlR*~qNxRkWB$*IV9Zx]Xmo}WBWC';

  const localeLabels: Record<string, string> = {
    en: 'English',
    bn: 'বাংলা',
  };

  const id = $props.id();

  const CredentialSchema = z.array(
    z.object({
      email: z.email(),
      password: z.string(),
      label: z.string(),
    }),
  );

  const credentials = CredentialSchema.parse(credentialsData);

  const client = useConvexClient();

  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let loading = $state(false);

  function autofill(eVal: string, pVal: string) {
    email = eVal;
    password = pVal;
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    loading = true;

    try {
      const res = await client.mutation(api.users.login, { email, passwordHash: password });

      if (!res) {
        error = m.error_invalid_credentials();
        return;
      }

      setSession({
        userId: res.userId,
        name: res.name,
        email: res.email,
        role: res.role,
        avatarUrl: res.avatarUrl,
      });

      await goto('/dashboard');
    } catch (err) {
      error = err instanceof Error ? err.message : m.error_login_failed();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
  <div class="fixed top-4 right-4 z-50 flex items-center gap-2">
    <Button variant="ghost" size="icon" onclick={toggleMode} class="rounded-full">
      {#if mode.current === 'dark'}
        <SunIcon class="size-5" />
      {:else}
        <MoonIcon class="size-5" />
      {/if}
      <span class="sr-only">{m.toggle_theme()}</span>
    </Button>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button variant="ghost" size="icon" {...props} class="rounded-full">
            <GlobeIcon class="size-5" />
            <span class="sr-only">{m.toggle_language()}</span>
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {#each locales as locale (locale)}
          <DropdownMenu.Item onclick={() => setLocale(locale)}>
            {localeLabels[locale] ?? locale}
            {#if getLocale() === locale}
              <CheckIcon class="ml-auto size-4" />
            {/if}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
  <div class="w-full max-w-sm md:max-w-3xl">
    <div class="flex flex-col gap-6">
      <Card.Root class="overflow-hidden p-0">
        <Card.Content class="grid min-h-[550px] p-0 md:grid-cols-2">
          <form class="flex flex-col justify-center p-6 md:p-10" onsubmit={onSubmit}>
            <FieldGroup>
              <div class="mb-6 flex flex-col items-center gap-2 text-center">
                <h1 class="text-3xl font-bold">{m.login_welcome()}</h1>
                <p class="text-balance text-muted-foreground">{m.login_subtitle()}</p>
              </div>

              <ContextMenu.Root>
                <ContextMenu.Trigger>
                  <Field>
                    <FieldLabel for="email-{id}">{m.email()}</FieldLabel>
                    <Input id="email-{id}" type="email" placeholder="somik@uiu.ac.bd" required bind:value={email} />
                  </Field>
                </ContextMenu.Trigger>
                <ContextMenu.Content>
                  <ContextMenu.Label>{m.debug_autofill()}</ContextMenu.Label>
                  <ContextMenu.Separator />
                  {#each credentials as cred (cred.email)}
                    <ContextMenu.Item onSelect={() => autofill(cred.email, cred.password)}>
                      {cred.label} - {cred.email}
                    </ContextMenu.Item>
                  {/each}
                </ContextMenu.Content>
              </ContextMenu.Root>

              <Field>
                <FieldLabel for="password-{id}">{m.password()}</FieldLabel>
                <Input id="password-{id}" type="password" required bind:value={password} />
              </Field>
              <Field>
                {#if error}
                  <div class="mb-2 text-sm font-medium text-destructive">{error}</div>
                {/if}
                <Button type="submit" class="w-full" disabled={loading}>
                  {#if loading}
                    <Spinner class="mr-2 h-4 w-4" />
                    {m.logging_in()}
                  {:else}
                    {m.login_button()}
                  {/if}
                </Button>
              </Field>
              <div class="mt-4 text-center text-sm">
                <a href="/forgot-password" class="underline underline-offset-4 hover:text-primary">
                  {m.forgot_password_link()}
                </a>
              </div>
            </FieldGroup>
          </form>

          <div
            class="relative hidden h-full w-full items-center justify-center overflow-hidden border-l select-none md:flex"
          >
            <Blurhash hash={loginImageBlurhash} class="absolute inset-0" />
            <enhanced:img
              src={loginImage}
              alt="graduation cap"
              class="absolute inset-0 h-full w-full object-cover"
              sizes="(min-width: 768px) 50vw, 0vw"
            />
          </div>
        </Card.Content>
      </Card.Root>

      {#snippet termsLink()}
        <a href="##" class="underline underline-offset-4 hover:text-primary">{m.terms_of_service()}</a>
      {/snippet}
      {#snippet privacyLink()}
        <a href="##" class="underline underline-offset-4 hover:text-primary">{m.privacy_policy()}</a>
      {/snippet}

      <FieldDescription class="px-6 text-center">
        <Translation
          text={m.terms_agreement({ terms: '[[terms]]', privacy: '[[privacy]]' })}
          map={{
            '[[terms]]': termsLink,
            '[[privacy]]': privacyLink,
          }}
        />
      </FieldDescription>
    </div>
  </div>
</div>

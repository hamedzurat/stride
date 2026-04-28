<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check';
  import GlobeIcon from '@lucide/svelte/icons/globe';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import SunIcon from '@lucide/svelte/icons/sun';
  import { mode, toggleMode } from 'mode-watcher';

  import loginImage from '$lib/assets/forgot-password-image.jpg?enhanced';
  import Blurhash from '$lib/components/ui/blurhash.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { Field, FieldDescription, FieldGroup, FieldLabel } from '$lib/components/ui/field/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import Translation from '$lib/components/ui/translation.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';

  const forgotPasswordImageBlurhash = 'U36[BX0LI^-hIBRjx@M}03-.${E8~n%MD+%I';

  const localeLabels: Record<string, string> = {
    en: 'English',
    bn: 'বাংলা',
  };

  const id = $props.id();
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
          <form class="flex flex-col justify-center p-6 md:p-10">
            <FieldGroup>
              <div class="mb-6 flex flex-col items-center gap-2 text-center">
                <h1 class="text-3xl font-bold">{m.reset_password_title()}</h1>
                <p class="text-balance text-muted-foreground">
                  {m.reset_password_subtitle()}
                </p>
              </div>

              <Field>
                <FieldLabel for="email-{id}">{m.email()}</FieldLabel>
                <Input id="email-{id}" type="email" placeholder="somik@uiu.ac.bd" required />
              </Field>

              <Field class="mt-4">
                <Button type="submit" class="w-full">{m.send_reset_link()}</Button>
              </Field>

              <div class="mt-4 text-center text-sm">
                {m.remember_password()}
                <a href="/login" class="underline underline-offset-4 hover:text-primary"> {m.log_in_link()} </a>
              </div>
            </FieldGroup>
          </form>

          <div
            class="relative hidden h-full w-full items-center justify-center overflow-hidden border-l select-none md:flex"
          >
            <Blurhash hash={forgotPasswordImageBlurhash} class="absolute inset-0" />
            <enhanced:img
              src={loginImage}
              alt="Ballon with smilly face flying away"
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

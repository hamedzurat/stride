<script lang="ts">
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  import * as Select from '$lib/components/ui/select/index.js';
  import type { Language } from '$lib/server/judge0';

  let {
    value = $bindable(),
    disabled = false,
  }: {
    value?: string;
    disabled?: boolean;
  } = $props();

  let languages: Language[] = $state([]);

  onMount(async () => {
    try {
      const res = await fetch('/api/judge0/languages');
      if (res.ok) {
        languages = await res.json();
        if (!value && languages.length > 0) {
          const python = languages.find((l) => l.name.toLowerCase().includes('python') && l.name.includes('3.'));
          if (python) {
            value = python.id.toString();
          } else {
            value = languages[0].id.toString();
          }
        }
      }
    } catch (_err) {
      toast.error('Failed to load supported languages.');
    }
  });

  let selectedLabel = $derived(languages.find((l) => l.id.toString() === value)?.name || 'Select language...');
</script>

<Select.Root type="single" bind:value {disabled}>
  <Select.Trigger class="h-9 w-[200px]">
    {selectedLabel}
  </Select.Trigger>
  <Select.Content class="max-h-[300px] overflow-y-auto">
    {#each languages as lang (lang.id)}
      <Select.Item value={lang.id.toString()} label={lang.name}>{lang.name}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>

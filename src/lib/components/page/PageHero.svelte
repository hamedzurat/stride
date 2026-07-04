<script lang="ts">
  let {
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions?: import('svelte').Snippet;
  } = $props();
</script>

<div
  class="relative overflow-hidden rounded-2xl border border-primary/10 bg-linear-to-r from-primary/5 via-primary/10 to-transparent p-6 md:p-8"
>
  <div class="flex items-start justify-between gap-4">
    <div class="flex flex-col gap-2 md:max-w-2xl">
      <h1 class="text-3xl font-black tracking-tight text-foreground md:text-4xl">{title}</h1>
      <p class="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
    {#if actions}
      <div class="flex shrink-0 flex-col gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>

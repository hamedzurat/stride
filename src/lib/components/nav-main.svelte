<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar/index.js';

  let {
    label,
    items,
  }: {
    label: string;
    items: {
      title: string;
      url: string;
      badge?: string;
      // this should be `Component` after @lucide/svelte updates types
      icon: any;
    }[];
  } = $props();
</script>

<Sidebar.Group>
  <Sidebar.GroupLabel>{label}</Sidebar.GroupLabel>
  <Sidebar.Menu>
    {#each items as item (item.title)}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton tooltipContent={item.title}>
          {#snippet child({ props })}
            <a href={item.url} {...props}>
              <item.icon class="size-4" />
              <span>{item.title}</span>
              {#if item.badge}
                <span
                  class="ml-auto flex h-4 shrink-0 animate-pulse items-center justify-center rounded-full bg-success/15 px-1.5 text-[9px] font-extrabold tracking-wider text-success uppercase"
                >
                  {item.badge}
                </span>
              {/if}
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {/each}
  </Sidebar.Menu>
</Sidebar.Group>

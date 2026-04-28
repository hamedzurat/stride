<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `src/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `bunx convex ai-files install`.

<!-- convex-ai-end -->

- **Safe Deletion**: Never use `rm`, `rmdir`, `shred`, or `unlink`. Always use `trash-cli` (e.g., `trash ./filename`) to ensure files are moved to the trash rather than permanently deleted.
- **Runtime & Package Management**: Use `bun` exclusively for all commands and package management. Do not use `node`, `npm`, `pnpm`, `yarn`, `npx`, or `pnpx`.
- **UI & Styling**: Prioritize `shadcn-svelte` components from `src/lib/components/ui` and use Tailwind CSS for styling. Do not define custom colors; instead, use the theme-consistent colors defined in `src/routes/layout.css`.
- **Svelte Best Practices**: Always use keyed `{#each}` blocks in Svelte (e.g., `{#each items as item (item.id)}` or `{#each items as item, i (i)}`) to ensure optimal DOM updates and avoid linting warnings.

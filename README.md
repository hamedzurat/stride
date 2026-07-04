# Stride

**A real-time academic assessment and competitive programming platform.**

---

## Demos and Whitelabeling

### Full Demo

<video src="asset/stride-project-video.mp4" controls width="100%"></video>

### AI-Assisted Problem Generation & Drafting

<video src="asset/2026-06-15_01-34-04.mp4" controls width="100%"></video>

### Whitelabel Capabilities (Theme Customization)

Stride is fully whitelabeled and supports deep theme customization. Below is a comparison of two theme presets showing the dynamic adaptability of the system's styling.

<div align="center" style="display: flex; gap: 10px;">
  <video src="asset/PXL_20260615_052158747.mp4" controls width="49%"></video>
  <video src="asset/PXL_20260615_052305619.mp4" controls width="49%"></video>
</div>

---

## Technical Stack

- **Frontend:** [Svelte 5](https://svelte.dev/) (using Svelte Runes for reactive state management), [Vite](https://vite.dev/), [Tailwind CSS v4](https://tailwindcss.com/), and [Shadcn-Svelte](https://www.shadcn-svelte.com/) components.
- **Real-time Backend:** [Convex](https://convex.dev/) database & serverless backend functions.
- **Code Execution:** [Judge0](https://judge0.com/) API (compiles and runs student submissions against dynamic test suites).
- **AI Automation:** OpenAI models powered by [Vercel AI SDK](https://sdk.vercel.ai/) for automatic problem drafting and teacher grading assistance.
- **Rich Editor:** [Tiptap](https://tiptap.dev/) with math typesetting ([KaTeX](https://katex.org/)) and [CodeMirror](https://codemirror.net/) for the code IDE.
- **Localization:** [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) via [Inlang](https://inlang.com/) for compile-time safe i18n.

---

## SDLC and Developer Experience (DX)

Stride includes several customized tools and strict validation suites to ensure a clean, maintainable, and type-safe codebase:

### Role-Based E2E Testing with Playwright

Our end-to-end suite ([docs/TESTING.md](./docs/TESTING.md)) splits automated test cases into three separate authenticated storage states:

- **Admin Flow:** Creating new student accounts and managing settings.
- **Teacher Flow:** Reviewing submissions, monitoring CCTV live streams, and viewing playback histories.
- **Student Flow:** Compiling and submitting Python code, using chat/forum features, and sharing screens.

### Git Flow and Branch Protection

To maintain main-branch stability, direct pushes to the `master` branch are strictly forbidden:

- **Pull Requests Only:** All development must occur on feature/fix branches. Changes can only be integrated into `master` via pull requests (PR).
- **Mandatory Peer Reviews:** Merging a PR requires a review and approval from at least one other team contributor.

### Git Hooks and Automated Commit Validation

We use Husky to run pre-commit and post-commit validations to ensure high code quality:

- **Commit Message Linting (`commit-msg`):** Enforces [Conventional Commits](./docs/commit-messages.md) formatting via `commitlint`. Commits with non-conforming messages are rejected automatically.
- **Code Pre-checks (`pre-commit`):**
  - Runs `lint-staged` to automatically format all modified files.
  - Triggers Svelte/TypeScript typechecking (`bun run check`) to ensure no broken or compilation-failing code can be committed.
- **Dead Code Detection:** We run `knip` to identify unused files, exports, and dependencies before integration.

---

## Getting Started

Detailed instructions for setup, running development servers, local Judge0 setups, and deployment can be found in our documentation folder:

- [Getting Started & Setup](./docs/getting-started.md)
- [End-to-End Testing Guide](./docs/TESTING.md)
- [Commit Message Guidelines](./docs/commit-messages.md)
- [Database Seeding Instructions](./docs/seeding.md)
- [Production Deployment Guide](./docs/deployment.md)

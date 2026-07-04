# Stride End-to-End Testing Guide

This project uses [Playwright](https://playwright.dev/) for robust desktop end-to-end (E2E) testing against our local Svelte 5 and Convex backend platform.

---

## 🔑 Test Accounts & Roles

Tests are split into separate spec files based on role permissions and authentication states stored under `playwright/.auth/`:

| Role        | Email              | Password | Storage State Path              |
| :---------- | :----------------- | :------- | :------------------------------ |
| **Admin**   | `admin@uiu.bd`     | `pass`   | `playwright/.auth/admin.json`   |
| **Teacher** | `tanvin@uiu.bd`    | `pass`   | `playwright/.auth/teacher.json` |
| **Student** | `ffaisal23@uiu.bd` | `pass`   | `playwright/.auth/student.json` |

---

## 📂 Test Architecture

The testing suite is structured as follows:

1. **`tests/auth.setup.ts`**
   - Automatically runs first to authenticate all three users and save their session states into local JSON cookie files.
2. **`tests/student.spec.ts`**
   - **Public Landing Page Flow**: Runs without credentials to verify public landing page loading and navigation to `/login`.
   - **Authenticated Student Flow**: Groups all student actions sequentially in a single execution track. Reuses the student session, changes profile bio, executes Python code via Judge0, starts/stops screensharing, creates/comments/interacts with forum threads, messages in Chat, and logs out.
3. **`tests/teacher.spec.ts`**
   - Authenticates as a teacher to check taught sections, view live student streams in the CCTV Hub, review code execution timelines via Playback, delete the student's forum post, send messages in Chat, and logs out.
4. **`tests/admin.spec.ts`**
   - Authenticates as an administrator, navigates to "Manage Users", adds a new student user, and logs out.

---

## 🚀 Execution Scripts

Use `bun` to run the following scripts added to your `package.json`:

### 1. Run Tests Headless

To run the full suite in headless mode (default background runner):

```bash
bun run test:all
```

_Note: This automatically chains execution of the test suite and opens the HTML test report afterwards._

### 2. Run Tests Headed (Opens Browser)

To run the test suite and watch the actions happen inside a live browser window:

```bash
bun run test:headed
```

### 3. Open Interactive UI Mode

To open Playwright's interactive developer UI (permits inspecting selectors, stepping through test cases, and viewing step-by-step screenshots):

```bash
bunx playwright test --ui
```

### 4. View Report

To view the report of the last test execution:

```bash
bun run test:report
```

---

## ⚠️ Guidelines & Best Practices

- **Synchronous Waits**: Always use `await element.waitFor({ state: 'visible' })` before clicking elements to ensure asynchronous Convex subscriptions have populated the Svelte UI state.
- **Desktop Only**: Stride is strictly a desktop application. Do not run or write mobile-viewport tests.

import { expect, test as setup } from '@playwright/test';

const studentFile = 'playwright/.auth/student.json';
const teacherFile = 'playwright/.auth/teacher.json';
const adminFile = 'playwright/.auth/admin.json';

setup('authenticate student', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for Svelte 5 hydration

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill('ffaisal23@uiu.bd');
  await passwordInput.fill('pass');
  await submitButton.click();

  // Wait for the URL to change to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Verify dashboard has loaded
  await expect(page.locator('h1')).toBeVisible();

  await page.context().storageState({ path: studentFile });
});

setup('authenticate teacher', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for Svelte 5 hydration

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill('tanvin@uiu.bd');
  await passwordInput.fill('pass');
  await submitButton.click();

  // Wait for the URL to change to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Verify dashboard has loaded
  await expect(page.locator('h1')).toBeVisible();

  await page.context().storageState({ path: teacherFile });
});

setup('authenticate admin', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Wait for Svelte 5 hydration

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill('admin@uiu.bd');
  await passwordInput.fill('pass');
  await submitButton.click();

  // Wait for the URL to change to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Verify dashboard has loaded
  await expect(page.locator('h1')).toBeVisible();

  await page.context().storageState({ path: adminFile });
});

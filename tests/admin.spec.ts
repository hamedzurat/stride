import { expect, test } from '@playwright/test';

test.describe('Admin Operations', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Admin Full Flow', async ({ page }) => {
    // 1. Land on the administrative route.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const welcomeHeader = page.locator('h2', { hasText: 'Welcome back, Stride Admin' });
    await welcomeHeader.waitFor({ state: 'visible' });
    await expect(welcomeHeader).toBeVisible();

    // 2. Navigate via the sidebar option to "Manage Users".
    const manageUsersLink = page.getByRole('link', { name: 'Manage Users' });
    await manageUsersLink.waitFor({ state: 'visible' });
    await manageUsersLink.click();

    const manageUsersHeader = page.locator('h1', { hasText: 'User Management' });
    await manageUsersHeader.waitFor({ state: 'visible' });
    await expect(manageUsersHeader).toBeVisible();

    // 3. Click to add a new user, specify their role explicitly as a "student", fill out necessary fields, and submit to create the record.
    const addUserBtn = page.getByRole('button', { name: 'Add User' });
    await addUserBtn.waitFor({ state: 'visible' });
    await addUserBtn.click();

    const nameInput = page.locator('#new-name');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Test Student');

    const emailInput = page.locator('#new-email');
    await emailInput.fill(`teststudent_${Date.now()}@uiu.bd`);

    const passwordInput = page.locator('#new-password');
    await passwordInput.fill('password123');

    // Specify role explicitly as "student"
    const roleTrigger = page.locator('button', { hasText: 'Student' });
    await roleTrigger.waitFor({ state: 'visible' });
    await roleTrigger.click();

    const studentOption = page.locator('[data-slot="select-item"]', { hasText: 'Student' });
    await studentOption.waitFor({ state: 'visible' });
    await studentOption.click();

    const submitBtn = page.getByRole('button', { name: 'Create User' });
    await submitBtn.waitFor({ state: 'visible' });
    await submitBtn.click();

    // Verify success toast
    await expect(page.getByText('User created successfully')).toBeVisible();

    // 4. Explicitly log out at the end.
    const userButton = page.getByRole('button', { name: /Stride Admin/i });
    await userButton.waitFor({ state: 'visible' });
    await userButton.click();

    const logoutItem = page.getByRole('menuitem', { name: 'Log out' });
    await logoutItem.waitFor({ state: 'visible' });
    await logoutItem.click();

    await expect(page).toHaveURL(/.*login/);
  });
});

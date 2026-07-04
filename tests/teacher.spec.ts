import fs from 'fs';
import { expect, test } from '@playwright/test';

test.describe('Teacher Operations', () => {
  test.use({ storageState: 'playwright/.auth/teacher.json' });

  test('Teacher Full Flow', async ({ page }) => {
    // 1. Land on /dashboard and verify available taught sections.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const welcomeHeader = page.locator('h2', { hasText: 'Welcome back, Asnuva Tanvin' });
    await welcomeHeader.waitFor({ state: 'visible' });
    await expect(welcomeHeader).toBeVisible();

    // 2. CCTV Monitoring: Go to 'My Sections', pick an activity section, and access the CCTV monitoring interface to verify that student screenshare options render even if they show offline.
    const sectionButton = page.locator('button', { hasText: 'CSE 1111' });
    await sectionButton.waitFor({ state: 'visible' });
    await sectionButton.locator('svg').last().click();

    const cctvLink = page.getByRole('link', { name: 'CCTV Hub' });
    await cctvLink.waitFor({ state: 'visible' });
    await cctvLink.click();

    const cctvHeader = page.locator('h1', { hasText: 'CCTV Hub' });
    await cctvHeader.waitFor({ state: 'visible' });
    await expect(cctvHeader).toBeVisible();

    await expect(page.locator('text=Fahim Faisal').first()).toBeVisible();
    await expect(page.locator('text=Sadia Tabassum').first()).toBeVisible();
    await expect(page.locator('text=Tanvir Ahamed').first()).toBeVisible();

    // 3. Session Playback: Navigate to an activity playback, run a student's recorded snapshot execution video timeline, and click the "Run Last Snapshot" button.
    const playbackLink = page.getByRole('link', { name: 'Playback' });
    await playbackLink.waitFor({ state: 'visible' });
    await playbackLink.click();

    const reviewBtn = page.getByRole('button', { name: 'Review' }).first();
    await reviewBtn.waitFor({ state: 'visible' });
    await reviewBtn.click();

    const nextBtn = page.getByRole('button', { name: 'Next', exact: true });

    await nextBtn.waitFor({ state: 'visible' });
    await nextBtn.click({ force: true });

    await page.waitForTimeout(1000);
    await nextBtn.click({ force: true });

    await page.waitForTimeout(2000);

    const runBtn = page.getByRole('button', { name: /Run Submitted \(2\)/i });
    await runBtn.waitFor({ state: 'visible' });
    await runBtn.click();

    // // 4. Moderation flow: Navigate to the forum and find and delete the post previously made by the student.
    // const forumLink = page.getByRole('link', { name: 'Forum', exact: true });
    // await forumLink.waitFor({ state: 'visible' });
    // await forumLink.click();

    // let postTitle = 'Edited Help Title';
    // try {
    //   const postInfo = JSON.parse(fs.readFileSync('playwright/.auth/post-info.json', 'utf8'));
    //   postTitle = postInfo.postTitle;
    // } catch (_e) {
    //   console.warn('Could not read post-info.json, using default fallback title');
    // }

    // const postCard = page.locator('div[data-slot="card"]', { hasText: postTitle });
    // await postCard.waitFor({ state: 'visible' });
    // const deleteBtn = postCard.getByTitle('Delete Post');
    // await deleteBtn.waitFor({ state: 'visible' });
    // await deleteBtn.click();

    // const confirmDeleteBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Delete' });
    // await confirmDeleteBtn.waitFor({ state: 'visible' });
    // await confirmDeleteBtn.click();

    // await expect(postCard).toBeHidden();

    // // 5. Communication flow: Open the chat pane, select an active conversation channel, and send a message.
    // await page.goto('/chat');
    // await page.waitForLoadState('networkidle');

    // const chatBtn = page.getByRole('button', { name: /CSE 1111 - SPL Support/i });
    // await chatBtn.waitFor({ state: 'visible' });
    // await chatBtn.click();

    // const messageInput = page.getByPlaceholder('Type a message...');
    // await messageInput.waitFor({ state: 'visible' });
    // await messageInput.fill(`Hello from Teacher ${Date.now()}`);
    // await page.keyboard.press('Enter');

    // 6. Explicitly log out at the end.
    const userButton = page.getByRole('button', { name: /Asnuva Tanvin/i });
    await userButton.waitFor({ state: 'visible' });
    await userButton.click();

    const logoutItem = page.getByRole('menuitem', { name: 'Log out' });
    await logoutItem.waitFor({ state: 'visible' });
    await logoutItem.click();

    await expect(page).toHaveURL(/.*login/);
  });
});

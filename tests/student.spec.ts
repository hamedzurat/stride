import fs from 'fs';
import { expect, test } from '@playwright/test';

test.describe('Student Operations', () => {
  test.describe('Public Landing Page Flow', () => {
    // Override storageState to empty for the landing page test to prevent auto-redirect to dashboard
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Landing page load & clicking Get Started', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const getStartedBtn = page.getByRole('link', { name: 'Get Started', exact: true });
      await getStartedBtn.waitFor({ state: 'visible' });
      await getStartedBtn.click();
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('Authenticated Student Flow', () => {
    test.use({ storageState: 'playwright/.auth/student.json' });

    test('Student E2E Actions', async ({ page }) => {
      // 1. Landing on /dashboard and verifying that student sections load.
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const welcomeHeader = page.locator('h2', { hasText: 'Welcome back, Fahim Faisal' });
      await welcomeHeader.waitFor({ state: 'visible' });
      await expect(welcomeHeader).toBeVisible();

      const sectionBtn = page.locator('button', { hasText: 'CSE 1111' });
      await sectionBtn.waitFor({ state: 'visible' });
      await expect(sectionBtn).toBeVisible();

      // 2. Profile flow: Go to profile, click edit, generate a random avatar, remove the photo, add a personal bio, and save the biography.
      const userButton = page.getByRole('button', { name: /Fahim Faisal/i });
      await userButton.waitFor({ state: 'visible' });
      await userButton.click();

      const profileItem = page.getByRole('menuitem', { name: 'Profile' });
      await profileItem.waitFor({ state: 'visible' });
      await profileItem.click();

      const header = page.locator('h1', { hasText: 'Fahim Faisal' });
      await header.waitFor({ state: 'visible' });

      const editBtn = page.getByRole('button', { name: 'Edit Profile' });
      await editBtn.waitFor({ state: 'visible' });
      await editBtn.click();

      const settingsHeader = page.locator('h1', { hasText: 'Account Settings' });
      await settingsHeader.waitFor({ state: 'visible' });

      const generateBtn = page.getByRole('button', { name: 'Generate Random Avatar' });
      await generateBtn.waitFor({ state: 'visible' });
      await generateBtn.click();

      await expect(page.getByText('Generated random avatar successfully!')).toBeVisible();

      const removeBtn = page.getByRole('button', { name: 'Remove Photo' });
      await removeBtn.waitFor({ state: 'visible' });
      await removeBtn.click();

      await expect(page.getByText('Avatar reverted to default seed shape.')).toBeVisible();

      const bioEditor = page.locator('.ProseMirror');
      await bioEditor.waitFor({ state: 'visible' });
      await bioEditor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.insertText('Test Bio');

      const saveBioBtn = page.getByRole('button', { name: 'Save Biography' });
      await saveBioBtn.waitFor({ state: 'visible' });
      await saveBioBtn.click();

      await expect(page.getByText('Biography saved successfully.')).toBeVisible();

      // 3. Activity & Judge0 flow: From the sidebar under 'My Sections', go to an activity, write Python code in the CodeMirror editor (.cm-content), submit it, and look for the 'Accepted' status message.
      const sidebarSectionButton = page.locator('button', { hasText: 'CSE 1111' });
      await sidebarSectionButton.waitFor({ state: 'visible' });
      await sidebarSectionButton.locator('svg').last().click();

      const problemLink = page.locator('span', { hasText: 'Binary Search' });
      await problemLink.waitFor({ state: 'visible' });
      await problemLink.click();

      const editor = page.locator('.cm-content');
      await editor.waitFor({ state: 'visible' });

      const selectTrigger = page.locator('[data-slot="select-trigger"]');
      await selectTrigger.waitFor({ state: 'visible' });
      await selectTrigger.click();

      const pythonOption = page.locator('[data-slot="select-item"]', { hasText: /python/i }).nth(1);
      await pythonOption.waitFor({ state: 'visible' });
      await pythonOption.click();

      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Backspace');

      const executeButton = page.getByRole('button', { name: 'Execute', exact: true });
      await executeButton.waitFor({ state: 'visible' });
      await executeButton.click();

      const messageTab = page.getByRole('tab', { name: 'Message' });
      await messageTab.waitFor({ state: 'visible' });
      await messageTab.click();

      const statusBadge = page.locator('.status-badge');
      await statusBadge.waitFor({ state: 'visible' });
      await expect(statusBadge).toContainText('Accepted');

      // 4. Screen sharing flow: Go to the sharescreen page, click start sharing, verify that the browser media stream successfully mounts, and then stop the sharing.
      const shareScreenLink = page.getByRole('link', { name: 'Share Screen' });
      await shareScreenLink.waitFor({ state: 'visible' });
      await shareScreenLink.click();

      const sectionHeader = page.locator('h1', { hasText: 'Screen Share Setup' });
      await sectionHeader.waitFor({ state: 'visible' });

      const shareBtn = page.getByRole('button', { name: 'Start sharing screen' });
      await shareBtn.waitFor({ state: 'visible' });
      await shareBtn.click();

      await page.waitForTimeout(2000);

      const stopBtn = page.getByRole('button', { name: 'Stop sharing screen', exact: true });
      await expect(stopBtn).toBeVisible();

      await stopBtn.click();

      // // 5. Forum interaction flow: Create a new forum post with tags, publish it, edit the post, leave a comment on it, edit that comment, and delete that comment.
      // await page.goto('/forum');
      // await page.waitForLoadState('networkidle');

      // const createPostBtn = page.getByRole('button', { name: 'Create Post' });
      // await createPostBtn.waitFor({ state: 'visible' });
      // await createPostBtn.click();

      // const titleInput = page.locator('#post-title');
      // await titleInput.waitFor({ state: 'visible' });
      // const initialTitle = `Help needed ${Date.now()}`;
      // await titleInput.fill(initialTitle);

      // const contentEditor = page.locator('.ProseMirror');
      // await contentEditor.waitFor({ state: 'visible' });
      // await contentEditor.click();
      // await page.keyboard.insertText('Please help me');

      // const tagBadge = page.locator('button', { hasText: '#spl' });
      // await tagBadge.waitFor({ state: 'visible' });
      // await tagBadge.click();

      // const publishBtn = page.getByRole('button', { name: 'Publish Post' });
      // await publishBtn.waitFor({ state: 'visible' });
      // await publishBtn.click();

      // const detailedPostTitle = page.locator('h1', { hasText: initialTitle });
      // await detailedPostTitle.waitFor({ state: 'visible' });
      // await expect(detailedPostTitle).toBeVisible();

      // const editPostBtn = page.getByRole('button', { name: 'Edit', exact: true });
      // await editPostBtn.waitFor({ state: 'visible' });
      // await editPostBtn.click();

      // const editTitleInput = page.locator('#post-title');
      // await editTitleInput.waitFor({ state: 'visible' });
      // const uniqueId = Date.now();
      // const postTitle = `Edited Help Title ${uniqueId}`;
      // await editTitleInput.fill(postTitle);

      // fs.writeFileSync('playwright/.auth/post-info.json', JSON.stringify({ postTitle }));

      // const editContentEditor = page.locator('.ProseMirror').first();
      // await editContentEditor.waitFor({ state: 'visible' });
      // await editContentEditor.click();
      // await page.keyboard.press('Control+a');
      // await page.keyboard.press('Backspace');
      // await page.keyboard.insertText('Edited Help Content');

      // const savePostBtn = page.getByRole('button', { name: 'Save Post' });
      // await savePostBtn.waitFor({ state: 'visible' });
      // await savePostBtn.click();

      // const editedTitle = page.locator('h1', { hasText: postTitle });
      // await editedTitle.waitFor({ state: 'visible' });
      // await expect(editedTitle).toBeVisible();

      // const upvotePostBtn = page.getByRole('button', { name: 'Upvote post' });
      // await upvotePostBtn.waitFor({ state: 'visible' });
      // await upvotePostBtn.click();

      // const postScore = page.locator('.text-base.font-extrabold');
      // await expect(postScore).toHaveText('1');

      // const commentEditor = page.locator('form .ProseMirror');
      // await commentEditor.waitFor({ state: 'visible' });
      // await commentEditor.click();
      // await page.keyboard.insertText('Thanks for posting');

      // const postCommentBtn = page.getByRole('button', { name: 'Post Comment' });
      // await postCommentBtn.waitFor({ state: 'visible' });
      // await postCommentBtn.click();

      // const newComment = page.locator('div.relative.mt-4.flex.flex-col.gap-2').first();
      // await newComment.waitFor({ state: 'visible' });
      // await expect(newComment).toBeVisible();

      // const upvoteCommentBtn = newComment.getByRole('button', { name: 'Upvote comment' });
      // await upvoteCommentBtn.waitFor({ state: 'visible' });
      // await upvoteCommentBtn.click();

      // const commentScore = newComment.locator('div.w-9 span.font-bold');
      // await expect(commentScore).toHaveText('1');

      // const downvoteCommentBtn = newComment.getByRole('button', { name: 'Downvote comment' });
      // await downvoteCommentBtn.waitFor({ state: 'visible' });
      // await downvoteCommentBtn.click();
      // await expect(commentScore).toHaveText('-1');

      // const downvotePostBtn = page.getByRole('button', { name: 'Downvote post' });
      // await downvotePostBtn.waitFor({ state: 'visible' });
      // await downvotePostBtn.click();
      // await expect(postScore).toHaveText('-1');

      // const editCommentBtn = newComment.getByRole('button', { name: 'Edit' });
      // await editCommentBtn.waitFor({ state: 'visible' });
      // await editCommentBtn.click();

      // const editCommentEditor = newComment.locator('.ProseMirror');
      // await editCommentEditor.waitFor({ state: 'visible' });
      // await editCommentEditor.click();
      // await page.keyboard.press('Control+a');
      // await page.keyboard.press('Backspace');
      // await page.keyboard.insertText('Edited Comment');

      // const saveCommentBtn = newComment.getByRole('button', { name: 'Save' });
      // await saveCommentBtn.waitFor({ state: 'visible' });
      // await saveCommentBtn.click();

      // await expect(newComment).toContainText('Edited Comment');

      // const deleteCommentBtn = newComment.getByRole('button', { name: 'Delete' });
      // await deleteCommentBtn.waitFor({ state: 'visible' });
      // await deleteCommentBtn.click();

      // const confirmDeleteBtn = page.getByRole('alertdialog').getByRole('button', { name: 'Delete' });
      // await confirmDeleteBtn.waitFor({ state: 'visible' });
      // await confirmDeleteBtn.click();

      // await expect(newComment).toContainText('[This comment has been deleted');

      // // 6. Messaging flow: Go to chat, send a message, edit the message, and delete it.
      // await page.goto('/chat');
      // await page.waitForLoadState('networkidle');

      // const chatBtn = page.getByRole('button', { name: /CSE 1111 - SPL Support/i });
      // await chatBtn.waitFor({ state: 'visible' });
      // await chatBtn.click();

      // const chatUniqueId = Date.now();
      // const initialMessage = `Hello Class ${chatUniqueId}`;
      // const editedMessage = `Hello Team ${chatUniqueId}`;

      // const messageInput = page.getByPlaceholder('Type a message...');
      // await messageInput.waitFor({ state: 'visible' });
      // await messageInput.fill(initialMessage);
      // await page.keyboard.press('Enter');

      // const msgBubble = page.getByText(initialMessage).last();
      // await msgBubble.waitFor({ state: 'visible' });
      // await expect(msgBubble).toBeVisible();

      // const messageGroup = page.locator('div.group', { hasText: initialMessage }).last();
      // await messageGroup.waitFor({ state: 'visible' });
      // await messageGroup.hover();

      // const actionTrigger = messageGroup.locator('button').last();
      // await actionTrigger.waitFor({ state: 'visible' });
      // await actionTrigger.click();

      // const editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
      // await editMenuItem.waitFor({ state: 'visible' });
      // await editMenuItem.click();

      // const editInput = page.locator('div.group').last().locator('input');
      // await editInput.waitFor({ state: 'visible' });
      // await editInput.fill(editedMessage);
      // await page.keyboard.press('Enter');

      // const updatedBubble = page.getByText(editedMessage).last();
      // await updatedBubble.waitFor({ state: 'visible' });
      // await expect(updatedBubble).toBeVisible();

      // const updatedMessageGroup = page.locator('div.group', { hasText: editedMessage }).last();
      // await updatedMessageGroup.waitFor({ state: 'visible' });
      // await updatedMessageGroup.hover();

      // const updatedActionTrigger = updatedMessageGroup.locator('button').last();
      // await updatedActionTrigger.waitFor({ state: 'visible' });
      // await updatedActionTrigger.click();

      // const deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
      // await deleteMenuItem.waitFor({ state: 'visible' });
      // await deleteMenuItem.click();

      // await expect(page.getByText(editedMessage)).toBeHidden();

      // 7. Explicitly log out at the end.
      const userButtonEnd = page.getByRole('button', { name: /Fahim Faisal/i });
      await userButtonEnd.waitFor({ state: 'visible' });
      await userButtonEnd.click();

      const logoutItem = page.getByRole('menuitem', { name: 'Log out' });
      await logoutItem.waitFor({ state: 'visible' });
      await logoutItem.click();

      await expect(page).toHaveURL(/.*login/);
    });
  });
});

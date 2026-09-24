import { test, expect } from '@playwright/test';

test.describe('Part 4: WebRTC File Transfer & Live Text Sharing', () => {
  test('single file transfer streams and completes end-to-end between two browser tabs', async ({ browser }) => {
    // 1. Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // 2. Sender tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Select single file
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    const fileContent = 'A'.repeat(64 * 1024); // 64 KiB text file
    await fileInput.setInputFiles({
      name: 'report-2026.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    });

    await expect(senderPage.locator('[data-testid="selected-files-list"]')).toBeVisible();
    await expect(senderPage.locator('text=report-2026.txt')).toBeVisible();

    // Enter receiver code
    const senderCodeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await senderCodeInput.fill(code);
    await senderPage.locator('[data-testid="add-receiver-btn"]').click();

    // 3. Receiver receives manifest and accepts transfer
    const acceptModal = receiverPage.locator('[data-testid="accept-decline-modal"]');
    await expect(acceptModal).toBeVisible({ timeout: 10000 });
    await expect(receiverPage.locator('[data-testid="manifest-file-count"]')).toHaveText('1');
    await expect(receiverPage.locator('text=report-2026.txt')).toBeVisible();

    // Tap Accept Transfer
    await receiverPage.locator('[data-testid="accept-btn"]').click();

    // 4. File streams across WebRTC data channel
    // Receiver shows transfer complete
    await expect(receiverPage.locator('[data-testid="receive-accepted-screen"]')).toBeVisible({ timeout: 15000 });
    await expect(receiverPage.locator('text=Transfer Complete')).toBeVisible();
    await expect(receiverPage.locator('text=report-2026.txt')).toBeVisible();

    // Sender's status updates to Done
    await expect(senderPage.locator('[data-testid="status-pill-done"]')).toBeVisible({ timeout: 15000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('multi-file transfer streams live fflate zip archive and completes end-to-end', async ({ browser }) => {
    // 1. Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

    // 2. Sender tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Select multiple files
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([
      {
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF Content for Multi-file Test'),
      },
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Meeting notes for multi-file zip test'),
      },
    ]);

    await expect(senderPage.locator('[data-testid="selected-files-list"]')).toBeVisible();
    await expect(senderPage.locator('text=document.pdf')).toBeVisible();
    await expect(senderPage.locator('text=notes.txt')).toBeVisible();

    // Enter receiver code
    const senderCodeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await senderCodeInput.fill(code);
    await senderPage.locator('[data-testid="add-receiver-btn"]').click();

    // 3. Receiver sees manifest with 2 files and accepts
    const acceptModal = receiverPage.locator('[data-testid="accept-decline-modal"]');
    await expect(acceptModal).toBeVisible({ timeout: 10000 });
    await expect(receiverPage.locator('[data-testid="manifest-file-count"]')).toHaveText('2');

    // Tap Accept Transfer
    await receiverPage.locator('[data-testid="accept-btn"]').click();

    // 4. Multi-file zip streams across WebRTC data channel
    // Receiver shows transfer complete with zip file
    await expect(receiverPage.locator('[data-testid="receive-accepted-screen"]')).toBeVisible({ timeout: 15000 });
    await expect(receiverPage.locator('text=Transfer Complete')).toBeVisible();
    await expect(receiverPage.locator('text=SharePort-')).toBeVisible();

    // Sender's status updates to Done
    await expect(senderPage.locator('[data-testid="status-pill-done"]')).toBeVisible({ timeout: 15000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('live text session synchronizes bi-directionally with Yjs and enforces edit permissions', async ({ browser }) => {
    // 1. Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

    // 2. Sender tab on /text
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/text');

    // Sender writes initial text
    const senderEditor = senderPage.locator('[data-testid="shared-text-editor"]');
    await senderEditor.fill('Hello from sender live text!');

    // Sender enters receiver code
    const senderCodeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await senderCodeInput.fill(code);
    await senderPage.locator('[data-testid="add-receiver-btn"]').click();

    // 3. Receiver receives text share request
    const acceptModal = receiverPage.locator('[data-testid="accept-decline-modal"]');
    await expect(acceptModal).toBeVisible({ timeout: 10000 });
    await expect(receiverPage.locator('text=Incoming Live Text')).toBeVisible();

    // Tap Join Text Session
    await receiverPage.locator('[data-testid="accept-btn"]').click();

    // 4. Receiver sees live text screen with sender content synced
    const receiverEditor = receiverPage.locator('[data-testid="receiver-text-editor"]');
    await expect(receiverEditor).toBeVisible({ timeout: 10000 });
    await expect(receiverEditor).toHaveValue('Hello from sender live text!', { timeout: 10000 });

    // 5. Receiver edits text and sender sees updates live
    await receiverEditor.fill('Hello from sender live text! Appended by receiver.');
    await expect(senderEditor).toHaveValue('Hello from sender live text! Appended by receiver.', { timeout: 5000 });

    // 6. Sender toggles edit off (TX-2)
    const allowEditToggle = senderPage.locator('[data-testid="allow-edit-toggle"]');
    await allowEditToggle.uncheck();

    // Receiver's editor becomes disabled
    await expect(receiverEditor).toBeDisabled({ timeout: 5000 });
    await expect(receiverPage.locator('[data-testid="readonly-badge"]')).toBeVisible();

    await receiverContext.close();
    await senderContext.close();
  });
});

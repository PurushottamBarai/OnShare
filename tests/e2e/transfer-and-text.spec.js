import { test, expect } from '@playwright/test';
import { setupWorkerContext } from './test-setup.js';

test.describe('Part 4: WebRTC File Transfer & Live Text Sharing', () => {
  test.beforeEach(async ({ browser, context, request }, testInfo) => {
    await setupWorkerContext({ browser, context, request }, testInfo);
  });

  test.afterEach(async ({ browser, page }) => {
    const pages = [];
    if (page && !page.isClosed()) pages.push(page);
    if (browser) {
      for (const ctx of browser.contexts()) {
        for (const p of ctx.pages()) {
          if (!p.isClosed() && !pages.includes(p)) pages.push(p);
        }
      }
    }

    for (const p of pages) {
      try {
        await p.evaluate(() => {
          if (window.__activePeerManagers) {
            for (const pm of window.__activePeerManagers) {
              try { pm.close(); } catch { /* ignore */ }
            }
            window.__activePeerManagers.clear();
          }
          if (window.__activeTextSessions) {
            for (const ts of window.__activeTextSessions) {
              try { ts.destroy(); } catch { /* ignore */ }
            }
            window.__activeTextSessions.clear();
          }
        });
      } catch {
        // Page might be already closed
      }
    }

    if (browser) {
      for (const ctx of browser.contexts()) {
        try { await ctx.close(); } catch { /* ignore */ }
      }
    }
  });

  test('single file transfer streams and completes end-to-end between two browser tabs', async ({ browser }) => {
    // 1. Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('.text-4xl.font-mono');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    // Wait until code is generated (not '------')
    await expect(codeDisplay).not.toHaveText(/------/, { timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // 2. Sender tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Select single file
    const fileInput = senderPage.locator('input[type="file"]');
    const fileContent = 'A'.repeat(64 * 1024); // 64 KiB text file
    await fileInput.setInputFiles({
      name: 'report-2026.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(fileContent),
    });

    await expect(senderPage.locator('text=Total Files:')).toBeVisible();
    await expect(senderPage.locator('text=report-2026.txt')).toBeVisible();

    // Enter receiver code
    const senderCodeInput = senderPage.locator('input[type="text"][maxLength="6"]:visible');
    await senderCodeInput.fill(code);
    await senderPage.locator('button[type="submit"]:visible').click();

    // 3. Receiver receives manifest and accepts transfer
    await expect(receiverPage.locator('text=1 file')).toBeAttached({ timeout: 10000 });
    
    // Tap Accept Transfer
    await receiverPage.locator('button:has-text("Accept")').first().click({ force: true });

    // 4. File streams across WebRTC data channel
    // Receiver shows transfer complete
    await expect(receiverPage.locator('text=Transfer Complete')).toBeVisible({ timeout: 15000 });

    // Sender's status updates to 100%
    await expect(senderPage.locator('text=100%')).toBeVisible({ timeout: 15000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('multi-file transfer streams live fflate zip archive and completes end-to-end', async ({ browser }) => {
    // 1. Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('.text-4xl.font-mono');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    await expect(codeDisplay).not.toHaveText(/------/, { timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

    // 2. Sender tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Select multiple files
    const fileInput = senderPage.locator('input[type="file"]');
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

    await expect(senderPage.locator('text=Total Files:')).toBeVisible();
    await expect(senderPage.locator('text=document.pdf')).toBeVisible();
    await expect(senderPage.locator('text=notes.txt')).toBeVisible();

    // Enter receiver code
    const senderCodeInput = senderPage.locator('input[type="text"][maxLength="6"]:visible');
    await senderCodeInput.fill(code);
    await senderPage.locator('button[type="submit"]:visible').click();

    // 3. Receiver sees manifest with 2 files and accepts
    await expect(receiverPage.locator('text=2 files')).toBeAttached({ timeout: 10000 });

    // Tap Accept Transfer
    await receiverPage.locator('button:has-text("Accept")').first().click({ force: true });

    // 4. Multi-file zip streams across WebRTC data channel
    // Receiver shows transfer complete
    await expect(receiverPage.locator('text=Transfer Complete')).toBeVisible({ timeout: 15000 });

    // Sender's status updates to 100%
    await expect(senderPage.locator('text=100%')).toBeVisible({ timeout: 15000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('live text session synchronizes bi-directionally with Yjs and enforces edit permissions', async ({ browser }) => {
    // 1. Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('.text-4xl.font-mono');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    await expect(codeDisplay).not.toHaveText(/------/, { timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

    // 2. Sender tab on /text
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/text');

    // Sender writes initial text
    const senderEditor = senderPage.locator('textarea');
    await senderEditor.fill('Hello from sender live text!');

    // Sender enters receiver code
    const senderCodeInput = senderPage.locator('input[type="text"][maxLength="6"]:visible');
    await senderCodeInput.fill(code);
    await senderPage.locator('button[type="submit"]:visible').click();

    // 3. Receiver receives text share request
    await expect(receiverPage.locator('text=Text Session')).toBeAttached({ timeout: 10000 });

    // Tap Join Text Session
    await receiverPage.locator('button:has-text("Accept")').first().click({ force: true });

    // 4. Receiver sees live text screen with sender content synced
    const receiverEditor = receiverPage.locator('textarea');
    await expect(receiverEditor).toBeVisible({ timeout: 10000 });
    await expect(receiverEditor).toHaveValue('Hello from sender live text!', { timeout: 10000 });

    // 5. Receiver edits text and sender sees updates live
    await receiverEditor.fill('Hello from sender live text! Appended by receiver.');
    await expect(senderEditor).toHaveValue('Hello from sender live text! Appended by receiver.', { timeout: 5000 });

    // 6. Sender toggles edit off (TX-2)
    const allowEditToggle = senderPage.locator('input[type="checkbox"]');
    await allowEditToggle.uncheck();

    // Receiver's editor becomes disabled
    await expect(receiverEditor).toBeDisabled({ timeout: 5000 });

    await receiverContext.close();
    await senderContext.close();
  });
});


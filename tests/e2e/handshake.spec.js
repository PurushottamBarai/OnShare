import { test, expect } from '@playwright/test';
import { setupWorkerContext } from './test-setup.js';

test.describe('Part 3 Handshake: Two-tab Receiver and Sender connection', () => {
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

  test('handles wrong-code error path on sender side', async ({ page }) => {
    await page.goto('/send');
    
    // Select files first to remove the "Waiting for files..." overlay
    await page.setInputFiles('input[type="file"]', [
      { name: 'dummy.txt', mimeType: 'text/plain', buffer: Buffer.from('data') }
    ]);

    // Type invalid 6-digit code
    const codeInput = page.locator('input[type="text"][maxLength="6"]:visible');
    await codeInput.fill('000000');

    const addBtn = page.locator('button[type="submit"]:visible');
    await addBtn.click();

    // Verify error message shown
    const errorText = page.locator('p.text-status-error');
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('handles real two-tab flow: code generation, match, and Accept/Decline screen with manifest info', async ({ browser }) => {
    // 1. Create Receiver Tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    // Receiver gets 6-digit code
    const codeDisplay = receiverPage.locator('.text-4xl.font-mono');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    await expect(codeDisplay).not.toHaveText(/------/, { timeout: 10000 });
    const formattedCode = await codeDisplay.innerText();
    const code = formattedCode.replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // 2. Create Sender Tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Simulate file selection on sender
    const fileInput = senderPage.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF Content for OnShare Test'),
      },
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Meeting notes test'),
      },
    ]);

    // Verify selected files list rendered
    await expect(senderPage.locator('text=Total Files:')).toBeVisible();
    await expect(senderPage.locator('text=report.pdf')).toBeVisible();
    await expect(senderPage.locator('text=notes.txt')).toBeVisible();

    // 3. Sender enters Receiver's 6-digit code
    const senderCodeInput = senderPage.locator('input[type="text"][maxLength="6"]:visible');
    await senderCodeInput.fill(code);

    const addReceiverBtn = senderPage.locator('button[type="submit"]:visible');
    await addReceiverBtn.click();

    // Sender sees receiver added in list with status pill
    await expect(senderPage.locator('text=Receiver')).toBeVisible({ timeout: 10000 });
    await expect(senderPage.locator('text=%')).toBeVisible({ timeout: 10000 });

    // 4. Receiver sees Accept / Decline prompt with manifest info
    await expect(receiverPage.locator('text=2 files')).toBeAttached({ timeout: 10000 });

    // 5. Receiver clicks Accept Transfer
    const acceptBtn = receiverPage.locator('button:has-text("Accept")').first();
    await acceptBtn.click({ force: true });

    // Receiver reaches accepted screen
    await expect(receiverPage.locator('text=Transfer Complete')).toBeVisible({ timeout: 5000 });

    // Sender's status updates to done
    await expect(senderPage.locator('text=100%')).toBeVisible({ timeout: 5000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('handles expired-code error path on receiver and sender', async ({ browser, request }, testInfo) => {
    // 1. Create Receiver Tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    // Receiver gets code
    const codeDisplay = receiverPage.locator('.text-4xl.font-mono');
    await expect(codeDisplay).toBeVisible({ timeout: 20000 });
    await expect(codeDisplay).not.toHaveText(/------/, { timeout: 20000 });
    const formattedCode = await codeDisplay.innerText();
    const code = formattedCode.replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // 2. Trigger code expiration on signaling server
    const workerIndex = testInfo != null ? String(testInfo.workerIndex) : (process.env.TEST_WORKER_INDEX || '0');
    const expireRes = await request.get(`http://127.0.0.1:8787/test/expire-code?code=${code}&workerIndex=${workerIndex}`);
    expect(expireRes.ok()).toBeTruthy();

    // 3. Sender tries to enter the expired code
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    const senderCodeInput = senderPage.locator('input[type="text"][maxLength="6"]:visible');
    await senderCodeInput.fill(code);
    const addReceiverBtn = senderPage.locator('button[type="submit"]:visible');
    await expect(addReceiverBtn).toBeEnabled({ timeout: 5000 });
    await addReceiverBtn.click();

    // Sender shows expired error
    const errorText = senderPage.locator('p.text-status-error');
    await expect(errorText).toBeVisible({ timeout: 20000 });

    // 4. Receiver clicks Regenerate Code
    const regenBtn = receiverPage.locator('button:has-text("Regenerate")');
    await regenBtn.click();

    // Receiver gets a new valid code and returns to waiting state
    await expect(codeDisplay).not.toHaveText(/------/, { timeout: 10000 });
    const newFormattedCode = await codeDisplay.innerText();
    const newCode = newFormattedCode.replace(/\s+/g, '');
    expect(newCode).toMatch(/^\d{6}$/);
    expect(newCode).not.toEqual(code);

    await receiverContext.close();
    await senderContext.close();
  });
});


import { test, expect } from '@playwright/test';

test.describe('Part 3 Handshake: Two-tab Receiver and Sender connection', () => {
  test('handles wrong-code error path on sender side', async ({ page }) => {
    await page.goto('/send');

    // Type invalid 6-digit code
    const codeInput = page.locator('[data-testid="receiver-code-input"]');
    await codeInput.fill('000000');

    const addBtn = page.locator('[data-testid="add-receiver-btn"]');
    await addBtn.click();

    // Verify error message shown
    const errorText = page.locator('[data-testid="code-error-text"]');
    await expect(errorText).toBeVisible({ timeout: 5000 });
    await expect(errorText).toContainText('Invalid code');
  });

  test('handles real two-tab flow: code generation, match, and Accept/Decline screen with manifest info', async ({ browser }) => {
    // 1. Create Receiver Tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    // Receiver gets 6-digit code
    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const formattedCode = await codeDisplay.innerText();
    const code = formattedCode.replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // Verify waiting status and countdown are active
    await expect(receiverPage.locator('text=Waiting for sender')).toBeVisible();
    await expect(receiverPage.locator('[data-testid="expiry-countdown"]')).toBeVisible();

    // 2. Create Sender Tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Simulate file selection on sender
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([
      {
        name: 'report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF Content for SharePort Test'),
      },
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Meeting notes test'),
      },
    ]);

    // Verify selected files list rendered
    await expect(senderPage.locator('[data-testid="selected-files-list"]')).toBeVisible();
    await expect(senderPage.locator('text=report.pdf')).toBeVisible();
    await expect(senderPage.locator('text=notes.txt')).toBeVisible();

    // 3. Sender enters Receiver's 6-digit code
    const senderCodeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await senderCodeInput.fill(code);

    const addReceiverBtn = senderPage.locator('[data-testid="add-receiver-btn"]');
    await addReceiverBtn.click();

    // Sender sees receiver added in list with status pill
    const receiverRow = senderPage.locator('[data-testid="receivers-list"]');
    await expect(receiverRow).toBeVisible({ timeout: 10000 });
    await expect(senderPage.locator('[data-testid="status-pill-waiting"]')).toBeVisible({ timeout: 10000 });

    // 4. Receiver sees Accept / Decline prompt with manifest info
    const acceptModal = receiverPage.locator('[data-testid="accept-decline-modal"]');
    await expect(acceptModal).toBeVisible({ timeout: 10000 });

    // Verify manifest details on receiver screen
    await expect(receiverPage.locator('[data-testid="manifest-file-count"]')).toHaveText('2');
    await expect(receiverPage.locator('text=report.pdf')).toBeVisible();
    await expect(receiverPage.locator('text=notes.txt')).toBeVisible();

    // 5. Receiver clicks Accept Transfer
    const acceptBtn = receiverPage.locator('[data-testid="accept-btn"]');
    await acceptBtn.click();

    // Receiver reaches accepted screen
    await expect(receiverPage.locator('[data-testid="receive-accepted-screen"]')).toBeVisible({ timeout: 5000 });

    // Sender's status updates to sending / accepted
    await expect(senderPage.locator('[data-testid="status-pill-sending"]')).toBeVisible({ timeout: 5000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('handles expired-code error path on receiver and sender', async ({ browser, request }) => {
    // 1. Create Receiver Tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    // Receiver gets code
    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const formattedCode = await codeDisplay.innerText();
    const code = formattedCode.replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // 2. Trigger code expiration on signaling server
    const expireRes = await request.get(`http://127.0.0.1:8787/test/expire-code?code=${code}`);
    expect(expireRes.ok()).toBeTruthy();

    // Receiver shows expired state
    await expect(receiverPage.locator('text=Code has expired after 10 minutes')).toBeVisible({ timeout: 5000 });
    await expect(receiverPage.locator('[data-testid="regenerate-code-btn"]')).toBeVisible();

    // 3. Sender tries to enter the expired code
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    const senderCodeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await senderCodeInput.fill(code);
    const addReceiverBtn = senderPage.locator('[data-testid="add-receiver-btn"]');
    await addReceiverBtn.click();

    // Sender shows expired error
    const errorText = senderPage.locator('[data-testid="code-error-text"]');
    await expect(errorText).toBeVisible({ timeout: 5000 });
    await expect(errorText).toContainText('Code has expired');

    // 4. Receiver clicks Regenerate Code
    const regenBtn = receiverPage.locator('[data-testid="regenerate-code-btn"]');
    await regenBtn.click();

    // Receiver gets a new valid code and returns to waiting state
    await expect(receiverPage.locator('text=Waiting for sender')).toBeVisible({ timeout: 5000 });
    const newFormattedCode = await codeDisplay.innerText();
    const newCode = newFormattedCode.replace(/\s+/g, '');
    expect(newCode).toMatch(/^\d{6}$/);

    await receiverContext.close();
    await senderContext.close();
  });
});

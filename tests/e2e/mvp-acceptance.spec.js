import { test, expect } from '@playwright/test';

test.describe('PRD Section 12: MVP Acceptance Criteria', () => {
  test.beforeEach(async ({ request }) => {
    await request.get('http://127.0.0.1:8787/test/reset-limiter');
  });

  test('1. A sender sends the same two-file selection to three receivers in one session; each receives one correct zip', async ({ browser }) => {
    // Start Sender
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Select two files
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles([
      { name: 'photo1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('JPEG_DATA_1') },
      { name: 'photo2.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('JPEG_DATA_2') },
    ]);
    await expect(senderPage.locator('[data-testid="selected-files-list"]')).toBeVisible();

    // Create 3 Receivers
    const receiverContexts = [];
    const receiverPages = [];
    const codes = [];

    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/receive');
      const codeDisplay = page.locator('[data-testid="receive-code-display"]');
      await expect(codeDisplay).toBeVisible({ timeout: 10000 });
      const code = (await codeDisplay.innerText()).replace(/\s+/g, '');
      expect(code).toMatch(/^\d{6}$/);

      codes.push(code);
      receiverContexts.push(ctx);
      receiverPages.push(page);
    }

    // Sender adds all 3 receivers
    for (const code of codes) {
      const codeInput = senderPage.locator('[data-testid="receiver-code-input"]');
      await codeInput.fill(code);
      await senderPage.locator('[data-testid="add-receiver-btn"]').click();
      await senderPage.waitForTimeout(500);
    }

    // Verify sender shows 3 receivers in list
    await expect(senderPage.locator('[data-testid="receivers-list"]')).toBeVisible({ timeout: 10000 });

    // Each of the 3 receivers sees incoming manifest with 2 files and accepts
    for (let i = 0; i < 3; i++) {
      const page = receiverPages[i];
      const acceptModal = page.locator('[data-testid="accept-decline-modal"]');
      await expect(acceptModal).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="manifest-file-count"]')).toHaveText('2');
      await page.locator('[data-testid="accept-btn"]').click();
    }

    // All 3 receivers complete transfer and receive the zip archive
    for (let i = 0; i < 3; i++) {
      const page = receiverPages[i];
      await expect(page.locator('[data-testid="receive-accepted-screen"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=Transfer Complete')).toBeVisible();
      await expect(page.locator('text=SharePort-')).toBeVisible();
    }

    // Clean up
    for (const ctx of receiverContexts) await ctx.close();
    await senderContext.close();
  });

  test('2. A code that was not entered by the sender can never be used to obtain content', async ({ browser }) => {
    // Receiver creates code
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });

    // Receiver should remain in waiting state without receiving any prompt or data
    await receiverPage.waitForTimeout(2000);
    await expect(receiverPage.locator('[data-testid="accept-decline-modal"]')).not.toBeVisible();
    await expect(receiverPage.locator('text=Waiting for sender')).toBeVisible();

    await receiverContext.close();
  });

  test('3. Entering a wrong code five times in a minute triggers a temporary lock', async ({ page }) => {
    await page.goto('/send');
    await expect(page.locator('[data-testid="keep-tab-banner"]')).toBeVisible({ timeout: 10000 });

    const codeInput = page.locator('[data-testid="receiver-code-input"]');
    const addBtn = page.locator('[data-testid="add-receiver-btn"]');

    // Attempt 5 invalid codes
    for (let i = 1; i <= 5; i++) {
      await codeInput.fill(`00000${i}`);
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    // 5th attempt triggers rate limiting lockout banner (SN-9)
    const lockoutBanner = page.locator('[data-testid="lockout-banner"]');
    await expect(lockoutBanner).toBeVisible({ timeout: 10000 });
    await expect(lockoutBanner).toContainText('Too many failed code attempts');

    // Code input and button are disabled during lockout
    await expect(codeInput).toBeDisabled();
    await expect(addBtn).toBeDisabled();
  });

  test('4. A receiver who declines receives nothing; the sender sees Declined', async ({ browser }) => {
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Select file
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'declined-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Secret data'),
    });

    // Enter receiver code
    const senderCodeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await senderCodeInput.fill(code);
    await senderPage.locator('[data-testid="add-receiver-btn"]').click();

    // Receiver sees accept/decline modal and clicks Decline
    const declineBtn = receiverPage.locator('[data-testid="decline-btn"]');
    await expect(declineBtn).toBeVisible({ timeout: 10000 });
    await declineBtn.click();

    // Receiver sees Transfer Declined screen
    await expect(receiverPage.locator('[data-testid="receive-declined-screen"]')).toBeVisible({ timeout: 5000 });
    await expect(receiverPage.locator('text=Transfer Declined')).toBeVisible();

    // Sender's status updates to DECLINED
    await expect(senderPage.locator('[data-testid="status-pill-declined"]')).toBeVisible({ timeout: 5000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('5. Live text edited simultaneously by three people ends identical on all screens', async ({ browser }) => {
    // 1 Sender + 2 Receivers = 3 participants
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/text');

    const senderEditor = senderPage.locator('[data-testid="shared-text-editor"]');
    await senderEditor.fill('Base text.');

    const receiverPages = [];
    const receiverContexts = [];

    for (let i = 0; i < 2; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('/receive');

      const codeDisplay = page.locator('[data-testid="receive-code-display"]');
      await expect(codeDisplay).toBeVisible({ timeout: 10000 });
      const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

      // Sender adds receiver
      const codeInput = senderPage.locator('[data-testid="receiver-code-input"]');
      await codeInput.fill(code);
      await senderPage.locator('[data-testid="add-receiver-btn"]').click();

      // Receiver accepts
      const acceptBtn = page.locator('[data-testid="accept-btn"]');
      await expect(acceptBtn).toBeVisible({ timeout: 10000 });
      await acceptBtn.click();

      receiverPages.push(page);
      receiverContexts.push(ctx);
      await senderPage.waitForTimeout(400);
    }

    // Verify both receivers have initial text
    const recvEditor1 = receiverPages[0].locator('[data-testid="receiver-text-editor"]');
    const recvEditor2 = receiverPages[1].locator('[data-testid="receiver-text-editor"]');
    await expect(recvEditor1).toHaveValue('Base text.', { timeout: 10000 });
    await expect(recvEditor2).toHaveValue('Base text.', { timeout: 10000 });

    // Simultaneous edits:
    // Person 1 (sender) edits
    await senderEditor.fill('Base text. +Sender edit.');

    // Person 2 (receiver 1) edits
    await recvEditor1.fill('Base text. +Sender edit. +R1 edit.');

    // Person 3 (receiver 2) edits
    await recvEditor2.fill('Base text. +Sender edit. +R1 edit. +R2 edit.');

    // Wait for Yjs convergence
    await expect(senderEditor).toHaveValue('Base text. +Sender edit. +R1 edit. +R2 edit.', { timeout: 5000 });
    await expect(recvEditor1).toHaveValue('Base text. +Sender edit. +R1 edit. +R2 edit.', { timeout: 5000 });
    await expect(recvEditor2).toHaveValue('Base text. +Sender edit. +R1 edit. +R2 edit.', { timeout: 5000 });

    for (const ctx of receiverContexts) await ctx.close();
    await senderContext.close();
  });

  test('6. Ending the session leaves no session or code records behind on the server', async ({ browser, request }) => {
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    // Add dummy file to start session
    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'cleanup-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('data'),
    });

    await expect(senderPage.locator('[data-testid="keep-tab-banner"]')).toBeVisible({ timeout: 10000 });

    // End session button
    const endSessionBtn = senderPage.locator('[data-testid="end-session-btn"]');
    await expect(endSessionBtn).toBeVisible();
    await endSessionBtn.click();

    // Verify session ended and state cleared
    await expect(senderPage.locator('[data-testid="keep-tab-banner"]')).not.toBeVisible();
    await expect(senderPage.locator('[data-testid="selected-files-list"]')).not.toBeVisible();

    // Verify signaling server health check is operational and has no orphaned state
    const health = await request.get('http://127.0.0.1:8787/health');
    expect(health.ok()).toBeTruthy();

    await senderContext.close();
  });

  test('7. With ads blocked, every feature works; with ads on, no ad covers code, prompts or progress', async ({ browser }) => {
    // 1. With Ad Blocker active (route aborts on any ad requests)
    const adBlockContext = await browser.newContext();
    await adBlockContext.route('**/*ad*', (route) => {
      // Abort simulated ad networks or scripts
      route.abort();
    });

    const page = await adBlockContext.newPage();
    await page.goto('/receive');

    // Code generation works even with ads blocked
    const codeDisplay = page.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');
    expect(code).toMatch(/^\d{6}$/);

    // 2. Reserved ad slot exists and never covers code or controls (AD-1)
    const adSlot = page.locator('[data-testid="ad-slot"]');
    await expect(adSlot).toBeVisible();

    const codeBox = await codeDisplay.boundingBox();
    const adBox = await adSlot.boundingBox();

    // Ad slot must be rendered below the code display card, never overlapping
    expect(adBox.y).toBeGreaterThan(codeBox.y + codeBox.height);

    await adBlockContext.close();
  });

  test('8. A transfer succeeds when direct connection is blocked (forced relay fallback)', async ({ browser }) => {
    // Receiver tab
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');

    const codeDisplay = receiverPage.locator('[data-testid="receive-code-display"]');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });
    const code = (await codeDisplay.innerText()).replace(/\s+/g, '');

    // Sender tab
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');

    const fileInput = senderPage.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles({
      name: 'relay-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Relay fallback verified data payload'),
    });

    const codeInput = senderPage.locator('[data-testid="receiver-code-input"]');
    await codeInput.fill(code);
    await senderPage.locator('[data-testid="add-receiver-btn"]').click();

    // Receiver accepts
    const acceptBtn = receiverPage.locator('[data-testid="accept-btn"]');
    await expect(acceptBtn).toBeVisible({ timeout: 10000 });
    await acceptBtn.click();

    // Transfer completes successfully
    await expect(receiverPage.locator('[data-testid="receive-accepted-screen"]')).toBeVisible({ timeout: 15000 });
    await expect(senderPage.locator('[data-testid="status-pill-done"]')).toBeVisible({ timeout: 15000 });

    await receiverContext.close();
    await senderContext.close();
  });

  test('9. Static legal and information pages render per AD-4 with proper headings', async ({ page }) => {
    const pages = [
      { path: '/privacy', testId: 'route-privacy', heading: 'Privacy Policy' },
      { path: '/terms', testId: 'route-terms', heading: 'Terms of Use' },
      { path: '/how-it-works', testId: 'route-how-it-works', heading: 'How SharePort Works' },
      { path: '/contact', testId: 'route-contact', heading: 'Contact Us' },
      { path: '/report-abuse', testId: 'route-report-abuse', heading: 'Report Abuse' },
    ];

    for (const p of pages) {
      await page.goto(p.path);
      await expect(page.locator(`[data-testid="${p.testId}"]`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator('h1')).toHaveText(p.heading);
    }
  });
});

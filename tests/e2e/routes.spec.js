import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', testId: 'route-home' },
  { path: '/send', testId: 'route-send' },
  { path: '/receive', testId: 'route-receive' },
  { path: '/text', testId: 'route-text' },
  { path: '/how-it-works', testId: 'route-how-it-works' },
  { path: '/privacy', testId: 'route-privacy' },
  { path: '/terms', testId: 'route-terms' },
  { path: '/contact', testId: 'route-contact' },
  { path: '/report-abuse', testId: 'route-report-abuse' },
  { path: '/components', testId: 'route-components' },
];

test.describe('Route shell placeholder rendering', () => {
  for (const { path, testId } of routes) {
    test(`renders route shell placeholder for ${path}`, async ({ page }) => {
      await page.goto(path);
      const element = page.locator(`[data-testid="${testId}"]`);
      await expect(element).toBeVisible();
    });
  }
});

test.describe('Home Screen & Theme Verification (UI Brief Section 3 & 4.1)', () => {
  test('renders 3 primary cards, 3-step strip, ad slot, and supports mobile responsive layout', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    await expect(page.locator('[data-testid="home-card-send"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-card-text"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-card-receive"]')).toBeVisible();
    await expect(page.locator('text=How SharePort Works')).toBeVisible();
    await expect(page.locator('[data-testid="ad-slot"]')).toBeVisible();

    // Mobile Viewport (HM-2 breakpoint <= 640px)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="home-card-send"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-card-text"]')).toBeVisible();
    await expect(page.locator('[data-testid="home-card-receive"]')).toBeVisible();
  });

  test('toggles between dark and light themes smoothly', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    // Check dark theme
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Click theme toggle button to switch to light
    const toggleBtn = page.locator('[data-testid="theme-toggle-btn"]');
    await toggleBtn.click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Click back to dark
    await toggleBtn.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('renders shared UI components in isolation with all documented states', async ({ page }) => {
    await page.goto('/components');

    // Status pills
    await expect(page.locator('[data-testid="status-pill-connecting"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-pill-waiting"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-pill-sending"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="status-pill-done"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-pill-declined"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-pill-failed"]')).toBeVisible();

    // Device label chip
    await expect(page.locator('[data-testid="device-label-chip"]').first()).toBeVisible();

    // Lockout banner
    await expect(page.locator('[data-testid="lockout-banner"]').first()).toBeVisible();

    // Ad slot
    await expect(page.locator('[data-testid="ad-slot"]')).toBeVisible();
  });
});

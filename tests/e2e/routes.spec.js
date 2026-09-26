import { test, expect } from '@playwright/test';

const routes = [
  { path: '/', testId: 'route-dashboard' },
  { path: '/send', testId: 'route-dashboard' },
  { path: '/receive', testId: 'route-dashboard' },
  { path: '/text', testId: 'route-dashboard' },
];

const staticRoutes = [
  '/how-it-works',
  '/privacy',
  '/terms',
  '/contact',
  '/components',
];

test.describe('Route shell placeholder rendering', () => {
  for (const { path, testId } of routes) {
    test(`renders route shell placeholder for ${path}`, async ({ page }) => {
      await page.goto(path);
      const element = page.locator(`[data-testid="${testId}"]`);
      await expect(element).toBeVisible();
    });
  }

  for (const path of staticRoutes) {
    test(`renders route shell placeholder for ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main').first()).toBeVisible();
    });
  }
});

test.describe('Home Screen & Theme Verification', () => {
  test('renders tabbed interface for send, receive, and text modes, and supports mobile layout', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    await expect(page.locator('[data-testid="route-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="route-dashboard"] a[href="/send"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="route-dashboard"] a[href="/receive"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="route-dashboard"] a[href="/text"]:visible')).toBeVisible();

    // Mobile Viewport (HM-2 breakpoint <= 640px)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="route-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="route-dashboard"] a[href="/send"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="route-dashboard"] a[href="/receive"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="route-dashboard"] a[href="/text"]:visible')).toBeVisible();
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

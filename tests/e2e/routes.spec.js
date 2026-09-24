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

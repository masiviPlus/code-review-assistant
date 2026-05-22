import { test, expect } from '@playwright/test';

test.describe('Auth guard: protected routes redirect to login', () => {
  const protectedRoutes = [
    '/dashboard',
    '/submit',
    '/submissions/000000000000000000000000',
    '/achievements',
  ];

  for (const route of protectedRoutes) {
    test(`visiting ${route} when logged out redirects to /login`, async ({
      page,
    }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

      // The "from" query param should preserve the original destination
      const url = new URL(page.url());
      expect(url.searchParams.get('from')).toBe(route);
    });
  }

  test('login page is accessible when logged out', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('register page is accessible when logged out', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL('/register');
    await expect(
      page.getByRole('heading', { name: 'Create an account' }),
    ).toBeVisible();
  });
});

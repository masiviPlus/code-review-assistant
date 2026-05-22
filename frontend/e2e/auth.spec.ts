import { test, expect } from '@playwright/test';
import {
  testUser,
  registerViaApi,
  registerAndLoginViaUI,
  logoutViaUI,
  loginViaUI,
} from './helpers';

test.describe('Auth flow: register → login → logout', () => {
  test('register a new account and land on /submit', async ({ page }) => {
    const user = testUser('auth-reg');
    await registerAndLoginViaUI(page, user);
    // Nav should show the user's display name
    await expect(page.getByText(user.displayName)).toBeVisible();
  });

  test('logout redirects to the landing page', async ({ page }) => {
    const user = testUser('auth-logout');
    await registerAndLoginViaUI(page, user);
    await logoutViaUI(page);

    // After logout, user should be on the landing page
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    // Visiting /dashboard should redirect to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('login with existing account and land on /dashboard', async ({
    page,
  }) => {
    // Register via API so we can test the login UI independently
    const user = testUser('auth-login');
    await registerViaApi(user);

    await loginViaUI(page, user);
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(user.displayName)).toBeVisible();
  });

  test('login with wrong password shows an error', async ({ page }) => {
    const user = testUser('auth-bad');
    await registerViaApi(user);

    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should stay on /login and show an error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.text-destructive')).toBeVisible({
      timeout: 10_000,
    });
  });
});

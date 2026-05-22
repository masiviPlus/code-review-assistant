import { type Page, expect } from '@playwright/test';

const API_URL = 'http://localhost:4000';

/** Generate a unique test user for isolation between tests. */
export function testUser(prefix = 'e2e') {
  const id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    displayName: `Test ${id}`,
    email: `${id}@test.local`,
    password: 'Test1234!secure',
  };
}

/** Register a user directly via the API (skips the UI). */
export async function registerViaApi(user: {
  displayName: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API register failed (${res.status}): ${body}`);
  }
  return (await res.json()) as { ok: boolean; data: { accessToken: string } };
}

/** Register + login through the UI, ending on whatever page the app redirects to. */
export async function registerAndLoginViaUI(
  page: Page,
  user: { displayName: string; email: string; password: string },
) {
  await page.goto('/register');
  await page.getByLabel('Display name').fill(user.displayName);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // After register, the app redirects to /submit
  await expect(page).toHaveURL('/submit', { timeout: 15_000 });
}

/** Login through the UI with an already-registered user. */
export async function loginViaUI(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // After login, the app redirects to /dashboard
  await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
}

/** Click "Sign out" in the nav bar. */
export async function logoutViaUI(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
}

/** Submit code via the submit page. Assumes the user is already logged in. */
export async function submitCode(page: Page, code: string) {
  await page.goto('/submit');

  // Wait for the Monaco editor to be ready
  const editor = page.locator('.monaco-editor textarea');
  await editor.waitFor({ timeout: 15_000 });

  // Clear the editor and type the code
  await editor.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(code, { delay: 5 });

  // Click submit
  await page.getByRole('button', { name: 'Submit for review' }).click();

  // Wait for redirect to the submission detail page
  await expect(page).toHaveURL(/\/submissions\/[a-f0-9]+/, {
    timeout: 30_000,
  });
}

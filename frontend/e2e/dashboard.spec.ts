import { test, expect } from '@playwright/test';
import { testUser, registerAndLoginViaUI, submitCode } from './helpers';

const SAMPLE_CODE = `function add(a, b) {
  let result = a + b;
  return result;
}

console.log(add(2, 3));`;

test.describe('Dashboard stats after submission', () => {
  test('dashboard shows correct stats after one submission', async ({
    page,
  }) => {
    const user = testUser('dash-stats');
    await registerAndLoginViaUI(page, user);

    // Submit code first
    await submitCode(page, SAMPLE_CODE);

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Wait for dashboard to load (no longer shows "Loading…")
    await expect(page.getByText('Loading…')).not.toBeVisible({
      timeout: 15_000,
    });

    // Submissions stat should show "1"
    await expect(page.getByText('Submissions', { exact: true })).toBeVisible();

    // The submission count should be visible
    await expect(page.getByText('1').first()).toBeVisible();

    // Total points stat card should be visible
    await expect(page.getByText('Total points').nth(1)).toBeVisible();

    // Recent submissions section should have at least one entry with a score
    await expect(page.getByText('Recent submissions')).toBeVisible();
    await expect(page.locator('a[href^="/submissions/"]').first()).toBeVisible();
  });

  test('dashboard shows empty state for a fresh user', async ({ page }) => {
    const freshUser = testUser('dash-empty');
    await registerAndLoginViaUI(page, freshUser);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.getByText('Loading…')).not.toBeVisible({
      timeout: 15_000,
    });

    // Should see the empty state
    await expect(page.getByText('No submissions yet')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Submit your first review' }),
    ).toBeVisible();
  });
});

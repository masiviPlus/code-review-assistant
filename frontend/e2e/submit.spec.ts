import { test, expect } from '@playwright/test';
import { testUser, registerAndLoginViaUI, submitCode } from './helpers';

const SAMPLE_CODE = `function greet(name) {
  var greeting = "Hello, " + name;
  console.log(greeting);
  return greeting;
}

greet("world");`;

test.describe('Submit code and view results', () => {
  test('submit code, see score and issues on the result page', async ({
    page,
  }) => {
    const user = testUser('submit-score');
    await registerAndLoginViaUI(page, user);
    await submitCode(page, SAMPLE_CODE);

    // The review panel should show the overall score (fake provider returns 74)
    const scoreEl = page.locator('text=/\\d+/').first();
    await expect(scoreEl).toBeVisible({ timeout: 15_000 });

    // Breakdown section should be present
    await expect(page.getByText('Breakdown')).toBeVisible();

    // Issues section should list the 3 fake issues
    await expect(page.getByRole('heading', { name: /Issues/ })).toBeVisible();
    await expect(
      page.getByText('Consider using descriptive variable names'),
    ).toBeVisible();
    await expect(
      page.getByText('Use const instead of let when the variable is never reassigned'),
    ).toBeVisible();
    await expect(
      page.getByText('Potential null reference detected'),
    ).toBeVisible();
  });

  test('clicking an issue shows the suggestion', async ({ page }) => {
    const user = testUser('submit-click');
    await registerAndLoginViaUI(page, user);
    await submitCode(page, SAMPLE_CODE);

    // Click on an issue to expand it
    const issue = page.getByText('Consider using descriptive variable names');
    await expect(issue).toBeVisible({ timeout: 15_000 });
    await issue.click();

    // The suggestion should now be visible
    await expect(
      page.getByText('Rename short variable names to reflect their purpose.'),
    ).toBeVisible();
  });
});

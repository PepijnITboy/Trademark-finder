import { expect, test } from '@playwright/test';

/**
 * Smoke test covering the primary `/app` and `/platform` routes.
 *
 * These checks only assert on the static UI shell (branding, page
 * headings, navigation, and client-side interactions like the theme
 * toggle) so they pass against the Vite dev server alone. Data-dependent
 * content (tables, KPIs) is not asserted on here since it depends on
 * `@merkwacht/api` (and Supabase) actually running — see README.md for how
 * to run the full stack for end-to-end data flows.
 */

test.describe('customer app (/app)', () => {
  test('/app/overzicht shows the Merkwacht brand and Overzicht heading', async ({ page }) => {
    await page.goto('/app/overzicht');
    await expect(page.getByText('Merkwacht', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Overzicht' })).toBeVisible();
  });

  test('/app/bewaakte-merken renders the watched trademarks page', async ({ page }) => {
    await page.goto('/app/bewaakte-merken');
    await expect(page.getByRole('heading', { level: 1, name: 'Bewaakte merken' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Merk toevoegen' })).toBeVisible();
  });

  test('/app/bewaakte-merken/nieuw opens the add-watch wizard on step 1', async ({ page }) => {
    await page.goto('/app/bewaakte-merken/nieuw');
    await expect(page.getByRole('heading', { level: 1, name: 'Merk toevoegen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kies het register' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'BOIP' })).toBeVisible();
  });

  test('/app/matches renders the matches page', async ({ page }) => {
    await page.goto('/app/matches');
    await expect(page.getByRole('heading', { level: 1, name: 'Matches' })).toBeVisible();
  });

  test('/app/deadlines renders the deadlines page', async ({ page }) => {
    await page.goto('/app/deadlines');
    await expect(page.getByRole('heading', { level: 1, name: 'Deadlines' })).toBeVisible();
  });

  test('/app/instellingen: the dark theme toggle works', async ({ page }) => {
    await page.goto('/app/instellingen');
    await expect(page.getByRole('heading', { level: 1, name: 'Instellingen' })).toBeVisible();

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Donker' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('platform app (/platform)', () => {
  test('/platform/overzicht shows the Platformbeheer badge', async ({ page }) => {
    await page.goto('/platform/overzicht');
    await expect(page.getByText('Platformbeheer').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Platformoverzicht' })).toBeVisible();
  });

  test('/platform/registers renders the registers & connectors page', async ({ page }) => {
    await page.goto('/platform/registers');
    await expect(page.getByRole('heading', { level: 1, name: 'Registers en koppelingen' })).toBeVisible();
  });
});

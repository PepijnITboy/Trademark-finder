import { expect, test } from '@playwright/test';

/**
 * Smoke test covering the primary `/app` and `/platform` routes.
 */

test.describe('customer app (/app)', () => {
  test('/app/dashboard shows brand and Dashboard without add-mark CTA', async ({ page }) => {
    await page.goto('/app/dashboard');
    await expect(page.getByText('Merkwacht', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Klantomgeving')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Hoofdnavigatie' }).getByRole('button', { name: 'Mijn merken' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Merk toevoegen' })).toHaveCount(0);
  });

  test('/app/overzicht redirects to /app/dashboard', async ({ page }) => {
    await page.goto('/app/overzicht');
    await expect(page).toHaveURL(/\/app\/dashboard$/);
  });

  test('nav: Mijn merken, Merkbescherming group; organisatie menu omhoog', async ({ page }) => {
    await page.goto('/app/dashboard');
    const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' });

    const merken = nav.getByRole('button', { name: 'Mijn merken' });
    if ((await merken.getAttribute('aria-expanded')) === 'false') await merken.click();
    await expect(nav.getByRole('link', { name: 'Huidige merken' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Merken in archief' })).toBeVisible();

    const matches = nav.getByRole('button', { name: 'Merkbescherming' });
    if ((await matches.getAttribute('aria-expanded')) === 'false') await matches.click();
    const actief = nav.getByRole('link', { name: 'Actieve matches' });
    const mogelijk = nav.getByRole('link', { name: 'Mogelijke matches' });
    await expect(actief).toBeVisible();
    await expect(mogelijk).toBeVisible();
    const actiefBox = await actief.boundingBox();
    const mogelijkBox = await mogelijk.boundingBox();
    expect(actiefBox && mogelijkBox && actiefBox.y < mogelijkBox.y).toBeTruthy();

    await actief.click();
    await expect(page).toHaveURL(/\/app\/matches$/);
    await expect(nav.getByRole('link', { name: 'Actieve matches' })).toHaveAttribute('aria-current', 'page');

    await mogelijk.click();
    await expect(page).toHaveURL(/\/app\/matches\/mogelijk$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mogelijke matches' })).toBeVisible();

    await page.getByRole('button', { name: 'Organisatiemenu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Bedrijf en gebruikers' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Betalingen' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Merkrechtenchat' })).toBeVisible();
  });

  test('accordion: opening Merkbescherming closes Mijn merken', async ({ page }) => {
    await page.goto('/app/dashboard');
    const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' });

    const merken = nav.getByRole('button', { name: 'Mijn merken' });
    if ((await merken.getAttribute('aria-expanded')) === 'false') await merken.click();
    await expect(merken).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link', { name: 'Huidige merken' })).toBeVisible();

    const matches = nav.getByRole('button', { name: 'Merkbescherming' });
    await matches.click();
    await expect(matches).toHaveAttribute('aria-expanded', 'true');
    await expect(merken).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Huidige merken' })).toHaveCount(0);
  });

  test('/app/bewaakte-merken renders Mijn merken with add CTA', async ({ page }) => {
    await page.goto('/app/bewaakte-merken');
    await expect(page.getByRole('heading', { level: 1, name: 'Mijn merken' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Merk toevoegen' })).toBeVisible();
  });

  test('/app/bewaakte-merken/nieuw shows depotnummer step copy', async ({ page }) => {
    await page.goto('/app/bewaakte-merken/nieuw');
    await expect(page.getByRole('heading', { level: 1, name: 'Merk toevoegen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'BOIP' })).toBeVisible();
    await page.getByRole('button', { name: 'BOIP' }).click();
    await page.getByRole('button', { name: 'Volgende' }).click();
    await expect(page.getByRole('heading', { name: 'Officieel depotnummer' })).toBeVisible();
    await expect(page.getByLabel('Depotnummer')).toBeVisible();
  });

  test('/app/deadlines shows Oppositiedeadlines heading', async ({ page }) => {
    await page.goto('/app/deadlines');
    await expect(page.getByRole('heading', { level: 1, name: 'Oppositiedeadlines' })).toBeVisible();
  });

  test('/app/organisatie tabs and dark theme via weergave', async ({ page }) => {
    await page.goto('/app/organisatie?tab=weergave');
    await expect(page.getByRole('heading', { level: 1, name: 'Organisatie' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Donker', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Donker', exact: true }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('/app/instellingen redirects to organisatie weergave', async ({ page }) => {
    await page.goto('/app/instellingen');
    await expect(page).toHaveURL(/\/app\/organisatie/);
  });

  test('/app/abonnement and /app/betalingen render', async ({ page }) => {
    await page.goto('/app/abonnement');
    await expect(page.getByRole('heading', { level: 1, name: /Abonnement/i })).toBeVisible();
    await page.goto('/app/betalingen');
    await expect(page.getByRole('heading', { level: 1, name: /Betalingen/i })).toBeVisible();
  });

  test('nav Merkonderzoek is isolated from Merkbescherming', async ({ page }) => {
    await page.goto('/app/dashboard');
    const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' });

    const research = nav.getByRole('button', { name: 'Merkonderzoek' });
    if ((await research.getAttribute('aria-expanded')) === 'false') await research.click();
    await expect(nav.getByRole('link', { name: 'Nieuwe aanvraag' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Rapporten' })).toBeVisible();

    await nav.getByRole('link', { name: 'Nieuwe aanvraag' }).click();
    await expect(page).toHaveURL(/\/app\/merkonderzoek\/nieuw$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Nieuw merkonderzoek' })).toBeVisible();
    await expect(page.getByText(/geen juridisch advies/i).first()).toBeVisible();
    await expect(page.getByText(/geen garantie/i).first()).toBeVisible();

    await nav.getByRole('link', { name: 'Rapporten' }).click();
    await expect(page).toHaveURL(/\/app\/merkonderzoek$/);
    await expect(page.getByRole('heading', { level: 1, name: /Merkonderzoek rapporten/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nieuwe aanvraag' })).toHaveCount(0);
  });

  test('merkonderzoek scopes + drempel waarschuwing + hit-detail', async ({ page }) => {
    await page.goto('/app/merkonderzoek/nieuw');
    await page.getByPlaceholder('Bijv. NOVAFORM').fill('WILLEM P');
    await page.getByPlaceholder(/SaaS voor retailers/i).fill('Software en SaaS');
    await page.getByRole('button', { name: 'Volgende' }).click();

    await expect(page.getByPlaceholder(/Benelux, EUIPO/i)).toBeVisible();
    await expect(page.getByText('Benelux (BOIP)')).toBeVisible();
    await expect(page.getByText(/Nice-klassen voor BOIP/i)).toBeVisible();
    await page.getByRole('button', { name: 'Volgende' }).click();

    await page.locator('input[type="number"]').fill('25');
    await page.locator('input[type="number"]').blur();
    await expect(page.getByText(/Groot rapport/i)).toBeVisible();
    await expect(page.getByText(/geen invloed op de prijs/i)).toBeVisible();
    await page.getByRole('button', { name: 'Volgende' }).click();

    await page.getByRole('button', { name: /Start met credit|Betalen en starten/ }).click();
    await expect(page).toHaveURL(/\/app\/merkonderzoek\/(?!nieuw)[^/?]+/);
    await expect(page.getByRole('heading', { level: 1, name: /Rapport:/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Merk aanvragen via bureau' })).toBeVisible();
    await expect(page.getByText(/geen garantie op succesvolle registratie/i).first()).toBeVisible();
    await expect(page.getByText(/Software en SaaS/i)).toBeVisible();

    const hitRow = page.getByText('WILLEMPE').first();
    await expect(hitRow).toBeVisible();
    await hitRow.click();
    await expect(page.getByRole('heading', { name: 'Hit-detail' })).toBeVisible();
    await expect(page.getByText(/Willempe Holding/i).first()).toBeVisible();
    await expect(page.getByText(/Componentscores/i)).toBeVisible();
  });
});

test.describe('platform app (/platform)', () => {
  test('/platform/overzicht and chat nav', async ({ page }) => {
    await page.goto('/platform/overzicht');
    await expect(page.getByText('Platformbeheer').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Platformoverzicht' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' });
    const operatie = nav.getByRole('button', { name: 'Operatie' });
    if ((await operatie.getAttribute('aria-expanded')) === 'false') await operatie.click();
    await expect(nav.getByRole('link', { name: 'Merkrechtenchat' })).toBeVisible();
  });

  test('/platform/abonnementen and /platform/registers', async ({ page }) => {
    await page.goto('/platform/abonnementen');
    await expect(page.getByRole('heading', { level: 1, name: /Abonnement/i })).toBeVisible();
    await page.goto('/platform/registers');
    await expect(page.getByRole('heading', { level: 1, name: 'Registers en koppelingen' })).toBeVisible();
    await expect(page.getByText('Registercatalogus (platform)')).toBeVisible();
    await expect(page.getByText(/geen drempeltoeslag/i)).toBeVisible();
    await page.goto('/platform/merkonderzoek');
    await expect(page.getByRole('heading', { level: 1, name: 'Merkonderzoek' })).toBeVisible();
    await expect(page.getByText(/registerbasisprijzen/i)).toBeVisible();
  });

  test('/platform/klanten shows merkonderzoek scopes after order', async ({ page }) => {
    await page.request.post('http://localhost:3001/api/v1/name-research/orders', {
      data: {
        markText: 'PLATFORMTEST',
        intendedNicheNl: 'Platform e2e niche',
        scopes: [{ registryCode: 'BOIP', niceClasses: [9, 42] }],
        minScoreThreshold: 40,
        useCredit: false,
      },
    });
    await page.goto('/platform/merkonderzoek');
    await expect(page.getByText('PLATFORMTEST').first()).toBeVisible();
    await expect(page.getByText(/BOIP \(9, 42\)/).first()).toBeVisible();
    await page.goto('/platform/klanten');
    await expect(page.getByRole('heading', { level: 1, name: 'Klanten' })).toBeVisible();
    await expect(page.getByText('Merkonderzoek (deze klant)')).toBeVisible();
    await expect(page.getByText('PLATFORMTEST').first()).toBeVisible();
  });

  test('/platform/klanten, accounts and betalingen show customer sync', async ({ page }) => {
    await page.goto('/platform/klanten');
    await expect(page.getByRole('heading', { level: 1, name: 'Klanten' })).toBeVisible();
    await expect(page.getByText(/Organisatieprofiel|Contact-e-mail|Facturatie-e-mail/i).first()).toBeVisible();
    await page.goto('/platform/accounts');
    await expect(page.getByRole('heading', { level: 1, name: 'Accounts' })).toBeVisible();
    await page.goto('/platform/betalingen');
    await expect(page.getByRole('heading', { level: 1, name: /Betaling/i })).toBeVisible();
  });
});

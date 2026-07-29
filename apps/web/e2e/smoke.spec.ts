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

  test('merkonderzoek scopes + toelichting + hit-detail', async ({ page }) => {
    await page.goto('/app/merkonderzoek/nieuw');
    await page.getByPlaceholder('Bijv. NOVAFORM').fill('WILLEM P');
    await page.getByRole('button', { name: 'Volgende' }).click();

    await expect(page.getByPlaceholder(/Benelux, EUIPO/i)).toBeVisible();
    await expect(page.getByText('Benelux (BOIP)')).toBeVisible();
    await expect(page.getByText(/Nice-klassen voor BOIP/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alle klassen' })).toBeVisible();
    await page.getByRole('button', { name: 'Volgende' }).click();

    await expect(page.getByText('Toelichting (optioneel)')).toBeVisible();
    await page.getByPlaceholder(/SaaS voor retailers/i).fill('Software en SaaS');
    await expect(page.getByText(/Groot rapport/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Volgende' }).click();

    await page.getByRole('button', { name: /Betalen en starten/ }).click();
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

  test('/app/organisatie meldingen tab shows trigger column', async ({ page }) => {
    await page.goto('/app/organisatie?tab=meldingen');
    await expect(page.getByRole('heading', { name: 'Meldingsadressen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adres toevoegen' })).toBeVisible();
  });
});

test.describe('platform app (/platform)', () => {
  test('/platform/overzicht and IA nav', async ({ page }) => {
    await page.goto('/platform/overzicht');
    await expect(page.getByText('Platformbeheer').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Platformoverzicht' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' });
    const operatie = nav.getByRole('button', { name: 'Operatie' });
    if ((await operatie.getAttribute('aria-expanded')) === 'false') await operatie.click();
    await expect(nav.getByRole('link', { name: 'Notificaties' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Merkrechtenchat' })).toHaveCount(0);
    const systeem = nav.getByRole('button', { name: 'Systeem' });
    if ((await systeem.getAttribute('aria-expanded')) === 'false') await systeem.click();
    await expect(nav.getByRole('link', { name: 'Abonnementen' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Prijzen' })).toBeVisible();
  });

  test('/platform/abonnementen, prijzen and registers', async ({ page }) => {
    await page.goto('/platform/abonnementen');
    await expect(page.getByRole('heading', { level: 1, name: /Abonnement/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Uitzetten' }).first()).toBeVisible();
    await page.goto('/platform/prijzen');
    await expect(page.getByRole('heading', { level: 1, name: 'Prijzen' })).toBeVisible();
    await page.goto('/platform/registers');
    await expect(page.getByRole('heading', { level: 1, name: 'Registers en koppelingen' })).toBeVisible();
    await expect(page.getByText('Runtime-koppelingen')).toBeVisible();
    await expect(page.getByText(/−€5|\+€5/)).toHaveCount(0);
  });

  test('klanten list shows ≥2 orgs (OrgAlpha + OrgBeta)', async ({ page }) => {
    await page.goto('/platform/klanten');
    await expect(page.getByRole('heading', { level: 1, name: 'Klanten' })).toBeVisible();
    await expect(page.getByText('Lumaro B.V.')).toBeVisible();
    await expect(page.getByText('Fictieve Retail Groep B.V.')).toBeVisible();
  });

  test('klanten list → detail shows sections after research order', async ({ page }) => {
    await page.request.post('http://localhost:3001/api/v1/name-research/orders', {
      data: {
        markText: 'PLATFORMTEST',
        intendedNicheNl: 'Platform e2e niche',
        scopes: [{ registryCode: 'BOIP', niceClasses: [9, 42] }],
        minScoreThreshold: 40,
        useCredit: false,
      },
    });
    await page.goto('/platform/klanten');
    await expect(page.getByText('Lumaro B.V.')).toBeVisible();
    await expect(page.getByText('Fictieve Retail Groep B.V.')).toBeVisible();
    await page.getByText('Lumaro B.V.').click();
    await expect(page).toHaveURL(/\/platform\/klanten\/[^/]+/);
    await expect(page.getByRole('tab', { name: 'Facturen' })).toBeVisible();
    await page.getByRole('tab', { name: 'Merkonderzoek' }).click();
    await expect(page.getByText('PLATFORMTEST').first()).toBeVisible();
    await expect(page.getByText(/BOIP \(9, 42\)/).first()).toBeVisible();
  });

  test('/platform/imports and notificaties', async ({ page }) => {
    await page.goto('/platform/imports');
    await expect(page.getByRole('heading', { level: 1, name: /Imports/i })).toBeVisible();
    await expect(page.getByText('Merkbescherming').first()).toBeVisible();
    await page.goto('/platform/notificaties');
    await expect(page.getByRole('heading', { level: 1, name: 'Notificaties' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Versturen' })).toBeVisible();
  });
});

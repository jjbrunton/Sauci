import { expect, test } from '@playwright/test';
import { createRedemptionFixture } from '../helpers/local-postgres';

const web = process.env.WEB_URL;
if (!web) throw new Error('Run E2E through npm run verify:e2e');

test('marketing home renders the primary product journey', async ({ page }) => {
  await page.goto(web);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('link', { name: /get started|download/i }).first()).toBeVisible();
});

test('redemption validates input without calling the backend', async ({ page }) => {
  await page.goto(`${web}/redeem`);
  await page.getByLabel('Email Address').fill('not-an-email');
  await page.getByLabel('Redemption Code').fill('ANY-CODE');
  await page.getByRole('button', { name: 'Redeem Code' }).click();
  await expect(page.getByText('Please enter a valid email address')).toBeVisible();
});

test('redemption updates server state and visible product state', async ({ page }) => {
  const fixture = await createRedemptionFixture();
  try {
    await page.goto(`${web}/redeem`);
    await page.getByLabel('Email Address').fill(fixture.email);
    await page.getByLabel('Redemption Code').fill(fixture.code);
    await page.getByRole('button', { name: 'Redeem Code' }).click();
    await expect(page.getByRole('heading', { name: 'Code Redeemed!' })).toBeVisible();
    await expect(page.getByText(fixture.email)).toBeVisible();

    await expect(fixture.assertRedeemed()).resolves.toBeUndefined();
  } finally {
    await fixture.cleanup();
  }
});

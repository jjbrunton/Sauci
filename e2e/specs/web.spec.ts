import { expect, test } from '@playwright/test';
import { createRedemptionFixture } from '../helpers/local-supabase';

const web = process.env.WEB_URL ?? 'http://127.0.0.1:3000';

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

    const { data: profile, error: profileError } = await fixture.client
      .from('profiles').select('is_premium').eq('id', fixture.userId).single();
    expect(profileError).toBeNull();
    expect(profile?.is_premium).toBe(true);
    const { count, error: redemptionError } = await fixture.client
      .from('code_redemptions').select('*', { count: 'exact', head: true })
      .eq('code_id', fixture.codeId).eq('user_id', fixture.userId);
    expect(redemptionError).toBeNull();
    expect(count).toBe(1);
  } finally {
    await fixture.client.auth.admin.deleteUser(fixture.userId);
    await fixture.client.from('redemption_codes').delete().eq('id', fixture.codeId);
  }
});

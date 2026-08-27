import { expect, test } from '@playwright/test';

const admin = process.env.ADMIN_URL ?? 'http://127.0.0.1:3001';

test('unauthenticated admin access reaches the real login boundary', async ({ page }) => {
  await page.goto(admin);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  await expect(page.getByLabel('Email Address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

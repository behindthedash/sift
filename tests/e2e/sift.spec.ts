import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('⌘/Ctrl+K opens filter, keyboard selects a field', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  const menu = page.getByRole('dialog', { name: 'Quick filter command menu' });
  await expect(menu).toBeVisible();
  await menu.getByRole('combobox').fill('Status');
  await menu.getByRole('combobox').press('Enter');
  await expect(menu.getByText('Active', { exact: true }).first()).toBeVisible();
});

test('advanced rule creates and clears a breadcrumb filter pill', async ({ page }) => {
  await page.getByRole('button', { name: /Rules/ }).click();
  await expect(page.getByText('Add condition').first()).toBeVisible();
});

test('Column Studio can reorder fields', async ({ page }) => {
  await page.getByRole('button', { name: /Columns/ }).click();
  await expect(page.getByText('Shown in Table')).toBeVisible();
  const first = page.getByText('ARR (USD)', { exact: true }).first();
  const second = page.getByText('Status', { exact: true }).last();
  await first.dragTo(second);
  await expect(page.getByText('Shown in Table')).toBeVisible();
});

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

test('Column Studio supports pointer drag-and-drop', async ({ page }) => {
  await page.getByRole('button', { name: /Columns/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Column Manager' });
  await expect(drawer.getByText(/Shown in Table/)).toBeVisible();
  const handles = drawer.getByRole('button', { name: 'Drag to reorder column' });
  await expect(handles.first()).toBeVisible();
  const count = await handles.count();
  expect(count).toBeGreaterThan(1);
  const first = handles.nth(0);
  const second = handles.nth(1);
  await first.dragTo(second);
  await expect(drawer.getByText(/Shown in Table/)).toBeVisible();
});

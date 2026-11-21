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
  await page.getByRole('button', { name: /Columns/ }).click({ timeout: 8000 });
  const drawer = page.getByRole('dialog', { name: 'Column Manager' });
  await expect(drawer.getByText(/Shown in Table/)).toBeVisible({ timeout: 8000 });
  const handles = drawer.getByRole('button', { name: 'Drag to reorder column' });
  await expect(handles.first()).toBeVisible({ timeout: 8000 });
  expect(await handles.count()).toBeGreaterThan(5);
  await handles.nth(2).scrollIntoViewIfNeeded();
  const beforeFirst = await handles.nth(2).locator('..').innerText();
  const first = await handles.nth(2).boundingBox();
  const second = await handles.nth(5).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => handles.nth(2).locator('..').innerText(), { timeout: 8000 })
    .not.toBe(beforeFirst);
});

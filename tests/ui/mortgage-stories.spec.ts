import { test, expect } from '@playwright/test';

for (const [width, height] of [[320,568],[375,667],[390,844],[430,932],[844,390]]) {
  test(`Mortgage stories fit ${width}x${height} without cropping or stacked onboarding`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/pulsedv/mini-app/#/mortgage');
    const story = page.locator('dialog[aria-label="Знакомство с ипотекой"]');
    await expect(story).toBeVisible();
    await expect(page.getByLabel('Онбординг PULSEDV')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toHaveCount(0);
    for (let index = 0; index < 3; index++) {
      await expect.poll(() => story.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      const geometry = await story.evaluate(element => {
        const selectors = ['img', 'h2', '#mortgage-story-description', 'header', 'footer'];
        return selectors.map(selector => {
          const item = element.querySelector(selector)!;
          const rect = item.getBoundingClientRect();
          return { selector, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, fit: getComputedStyle(item).objectFit };
        });
      });
      for (const item of geometry) {
        expect(item.x, item.selector).toBeGreaterThanOrEqual(0);
        expect(item.y, item.selector).toBeGreaterThanOrEqual(0);
        expect(item.right, item.selector).toBeLessThanOrEqual(width + 1);
        expect(item.bottom, item.selector).toBeLessThanOrEqual(height + 1);
      }
      expect(geometry[0].fit).toBe('contain');
      await expect(story.getByText(/0[123]\/03/)).toHaveCount(0);
      await page.screenshot({ path: `test-results/mortgage-${width}-${height}-${index + 1}.png` });
      await story.getByRole('button', { name: index === 2 ? 'Перейти к расчёту' : 'Следующая история', exact: true }).click();
    }
    await expect(story).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ипотека', exact: true })).toBeVisible();
    await page.reload();
    await expect(story).toHaveCount(0);
    await page.getByRole('button', { name: 'Как работает ипотека' }).click();
    await expect(story).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(story).toHaveCount(0);
  });
}

test('Mortgage story waits for artwork and recovers after an image error', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/mortgage-v5-programs.png', async route => { await gate; await route.abort(); });
  await page.goto('/pulsedv/mini-app/#/mortgage', { waitUntil: 'domcontentloaded' });
  const story = page.locator('dialog[aria-label="Знакомство с ипотекой"]');
  await expect(story).toBeVisible();
  await expect(story.locator('i')).toHaveCSS('animation-play-state', 'paused');
  await expect(story.getByRole('heading')).toHaveText('Начните с выбора');
  release();
  await expect(story.getByText('Не удалось загрузить иллюстрацию')).toBeVisible();
  await page.unroute('**/mortgage-v5-programs.png');
  await story.getByRole('button', { name: 'Повторить' }).click();
  await expect(story.locator('i')).toHaveCSS('animation-play-state', 'running');
  const next = story.getByRole('button', { name: 'Следующая история' });
  const box = await next.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(story.locator('i')).toHaveCSS('animation-play-state', 'paused');
  await page.mouse.up();
  await page.keyboard.press('ArrowLeft');
  await expect(story.getByRole('heading')).toHaveText('Начните с выбора');
});

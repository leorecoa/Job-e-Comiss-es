import { expect, test } from 'playwright/test';

const sizes = [[375, 812], [390, 844], [430, 932], [768, 1024], [1280, 900], [1440, 900]];

for (const [width, height] of sizes) {
  test(`commercial landing without auth or tenant at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const operational: string[] = [];
    page.on('request', request => {
      if (/supabase|\/api\/|\/App\.tsx|\/bootstrap\.tsx|\/services\//.test(request.url())) operational.push(request.url());
    });
    await page.route('https://**/*', route => route.abort());
    await page.goto('/convite-parceiro');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Menos confusão na agenda.');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByText('Convite — Parceiro Fundador', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quero conhecer' })).toBeInViewport();
    await expect(page).toHaveURL(/\/convite-parceiro$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(operational).toEqual([]);
    // Check rendered foreground/background pairs, including muted and disabled text.
    const failures = await page.locator('.partner-page').evaluate(root => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number);
      const luminance = (values: number[]) => values.slice(0, 3).map(v => {
        const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      }).reduce((total, v, i) => total + v * [.2126, .7152, .0722][i], 0);
      return [...root.querySelectorAll('h1,h2,h3,p,a,li,strong,button,figcaption,time,span,em')].flatMap(element => {
        if (!element.textContent?.trim() || !element.getBoundingClientRect().height) return [];
        const style = getComputedStyle(element);
        let ancestor: Element | null = element;
        let background = [244, 239, 228];
        while (ancestor) {
          const value = rgb(getComputedStyle(ancestor).backgroundColor);
          if (value.length === 3 || value[3] === 1) { background = value; break; }
          ancestor = ancestor.parentElement;
        }
        const a = luminance(rgb(style.color)), b = luminance(background);
        const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
        return ratio + .01 < (large ? 3 : 4.5) ? [{ text: element.textContent.slice(0, 50), ratio }] : [];
      });
    });
    expect(failures).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
  });
}

test('anchors, WhatsApp contact, metadata and direct refresh remain institutional', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/convite-parceiro');
  await expect(page).toHaveTitle('Job & Comissões | Parceiro Fundador');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Gestão de agenda, equipe, serviços e comissões para barbearias.');
  await page.getByRole('link', { name: 'Ver como funciona', exact: true }).first().click();
  await expect(page).toHaveURL(/#como-funciona$/);
  await expect(page.getByRole('heading', { name: 'Seu cliente escolhe. Você acompanha.' })).toBeInViewport();
  const message = 'Olá! Vi a apresentação do Job & Comissões e quero conhecer a proposta de Parceiro Fundador.';
  for (const name of ['Quero conhecer', 'Quero ser Parceiro Fundador']) {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toHaveAttribute('href', `https://wa.me/5581989064910?text=${encodeURIComponent(message)}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.getByText(/Canal comercial em preparação/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver como funciona', exact: true }).last()).toHaveAttribute('href', '#como-funciona');
  await page.reload();
  await expect(page).toHaveURL(/\/convite-parceiro#como-funciona$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /Entrar|Criar conta/ })).toHaveCount(0);
});

test('keyboard focus and 200 percent reflow', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/convite-parceiro');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Ir para o conteúdo' })).toBeFocused();
  expect(await page.getByRole('link', { name: 'Ir para o conteúdo' }).evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#conteudo$/);
  await page.setViewportSize({ width: 640, height: 450 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: 'Quero conhecer' })).toBeVisible();
});

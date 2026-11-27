import {createHmac, randomUUID} from 'node:crypto';
import {expect, test} from '@playwright/test';

const telegramScript = 'https://telegram.org/js/**';

function fixtureInitData(userId: number) {
  const fields = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1_000)),
    query_id: randomUUID(),
    user: JSON.stringify({id: userId}),
  });
  const key = createHmac('sha256', 'WebAppData').update('123:fake-browser-only').digest();
  const data = [...fields].map(([name, value]) => name + '=' + value).join('\n');
  fields.set('hash', createHmac('sha256', key).update(data).digest('hex'));
  return fields.toString();
}

function sdkFixture(initData: string) {
  return {
    contentType: 'application/javascript',
    body: `window.Telegram={WebApp:{initData:${JSON.stringify(initData)},ready(){},expand(){},setHeaderColor(){}}}`,
  };
}

test('Expo locks on session revocation and reopens with a fresh Telegram launch', async ({page}) => {
  let initData = fixtureInitData(123);
  await page.route(telegramScript, route => route.fulfill(sdkFixture(initData)));
  const signedIn = page.waitForResponse(response => response.url().endsWith('/admin/v1/session'));
  await page.goto('/admin-app-expo/');
  expect((await signedIn).status()).toBe(200);
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toBeVisible();

  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'squid_admin_csrf')?.value;
  expect(csrf).toBeTruthy();
  const logout = await page.request.post('/admin/v1/logout', {
    headers: {origin: new URL(page.url()).origin, 'x-csrf-token': csrf!},
  });
  expect(logout.ok()).toBe(true);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert')).toHaveText('เซสชันหมดอายุ กรุณาปิดแล้วเปิดใหม่จาก Telegram');
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);

  const replay = page.waitForResponse(response => response.url().endsWith('/admin/v1/session'));
  await page.reload();
  expect((await replay).status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);

  initData = fixtureInitData(123);
  const reopened = page.waitForResponse(response => response.url().endsWith('/admin/v1/session'));
  await page.reload();
  expect((await reopened).status()).toBe(200);
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toBeVisible();
});

test('a signed Telegram launch still requires owner permission', async ({page}) => {
  await page.route(telegramScript, route => route.fulfill(sdkFixture(fixtureInitData(999))));
  const denied = page.waitForResponse(response => response.url().endsWith('/admin/v1/session'));
  await page.goto('/admin-app-expo/');
  expect((await denied).status()).toBe(403);
  await expect(page.getByRole('alert')).toHaveText('เปิดแอปนี้จาก Telegram ด้วยบัญชีเจ้าของร้าน');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  expect((await page.request.get('/admin/v1/overview')).status()).toBe(401);
});

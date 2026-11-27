import {expect, test} from '@playwright/test';

const reviewPath = '/admin/v1/orders?status=payment_review&include_mock=true';
const reviewPreview = '**' + reviewPath + '&limit=1';

test('Expo overview loads its fonts, reads dashboard data and opens the original order queue', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/preview?ui=expo');
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toBeVisible();
  const queueResponse = await page.request.get(reviewPath);
  expect(queueResponse.ok()).toBe(true);
  const queue = await queueResponse.json();
  const count = queue.counts.payment_review;
  expect(count).toBeGreaterThan(0);
  await expect(page.getByRole('button', {name: new RegExp('สลิปรอตรวจ ' + count + ' รายการ')})).toBeVisible();
  await expect(page.getByRole('button', {name: 'เปิดคิวตรวจสลิป'})).toContainText(String(count));
  const overviewResponse = await page.request.get('/admin/v1/overview?include_mock=true');
  expect(overviewResponse.ok()).toBe(true);
  const overview = await overviewResponse.json();
  const metrics = page.getByLabel('สถิติวันนี้');
  await expect(metrics.getByText('ยอดขายวันนี้', {exact: true}).locator('..')).toContainText('$' + overview.revenue_usd);
  await expect(metrics.getByText('กำไรขั้นต้น', {exact: true}).locator('..')).toContainText(
    overview.estimated_gross_profit_usd === null ? '—' : '$' + overview.estimated_gross_profit_usd,
  );
  await expect(metrics.getByText('ออเดอร์สำเร็จ', {exact: true}).locator('..')).toContainText(String(overview.counts.completed ?? 0));
  await expect(page.getByRole('heading', {name: 'ออเดอร์ล่าสุด'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'สถานะซัพพลายเออร์'})).toBeVisible();
  await expect(page.getByText('ระบบปกติ', {exact: true})).toBeVisible();
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = '22px "Stitch Material Symbols"';
    return {
      iconLoaded: [...document.fonts].some(font => font.family.includes('Stitch Material Symbols') && font.status === 'loaded'),
      interLoaded: [...document.fonts].some(font => font.family.includes('Inter Variable') && font.status === 'loaded'),
      icons: ['dashboard', 'receipt_long', 'chat_bubble_outline', 'settings', 'person', 'sports_esports', 'compare_arrows', 'chevron_right']
        .map(icon => Math.round(context.measureText(icon).width)),
    };
  });
  expect(fonts.iconLoaded).toBe(true);
  expect(fonts.interLoaded).toBe(true);
  expect(fonts.icons).toEqual(Array(8).fill(22));
  expect(errors).toEqual([]);

  await page.getByRole('button', {name: 'เปิดคิวตรวจสลิป'}).click();
  await expect(page).toHaveURL(/\/admin-app\/#\/orders\?status=payment_review/);
  await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');
  await expect(page.locator('.order-card')).toHaveCount(queue.data.length);
  await page.goBack();
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toBeVisible();
});

test('Expo requires a session and can recover a failed queue read', async ({page}) => {
  await page.route('https://telegram.org/js/**', route => route.fulfill({contentType: 'application/javascript', body: ''}));
  await page.goto('/admin-app-expo/');
  await expect(page.getByRole('alert')).toContainText('เปิดแอปนี้จาก Telegram');
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toHaveCount(0);
  await page.route(reviewPreview, route => route.fulfill({status: 503, json: {error: 'Unavailable'}}));
  await page.goto('/preview?ui=expo');
  await expect(page.getByRole('alert')).toContainText('โหลดข้อมูลบางส่วนไม่สำเร็จ');
  await expect(page.getByText('คิวตรวจสลิป', {exact: true})).toBeVisible();
  await page.unroute(reviewPreview);
  await page.getByRole('button', {name: 'ลองโหลดอีกครั้ง'}).click();
  await expect(page.getByText(/งานด่วน: สลิปรอตรวจ/)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Expo marks a cached queue as stale and opens the queue before relying on old data', async ({page}) => {
  await page.goto('/preview?ui=expo');
  const urgent = page.getByRole('button', {name: /งานด่วน: สลิปรอตรวจ/});
  await expect(urgent).toBeVisible();
  const countLabel = urgent.getByText(/งานด่วน: สลิปรอตรวจ/);
  const cached = await countLabel.innerText();
  await page.route(reviewPreview, route => route.fulfill({status: 503, json: {error: 'Unavailable'}}));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert')).toContainText('กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า');
  await expect(countLabel).toHaveText(cached);
  await urgent.click();
  await expect(page).toHaveURL(/\/admin-app\/#\/orders\?status=payment_review/);
  await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');
});

test('reading a chat updates the Expo inbox count when returning from the legacy conversation', async ({page}) => {
  await page.goto('/preview?ui=expo');
  const unread = (await (await page.request.get('/admin/v1/navigation')).json()).unread_chat_rooms;
  expect(unread).toBeGreaterThan(0);
  const shortcut = page.getByRole('button', {name: 'แชทลูกค้า', exact: true});
  const tab = page.getByRole('tab', {name: 'แชท ' + unread + ' รายการ', exact: true});
  await expect(shortcut).toContainText(String(unread));
  await expect(tab).toBeVisible();
  await shortcut.click();
  await expect(page.getByRole('heading', {name: 'ห้องสนทนาล่าสุด'})).toBeVisible();
  await page.getByRole('button', {name: 'ยังไม่อ่าน ' + unread, exact: true}).click();
  await expect(page.locator('.chat-card')).toHaveCount(unread);
  const read = page.waitForResponse(response => response.url().endsWith('/read') && response.ok());
  await page.locator('.chat-card').first().getByRole('button', {name: 'เปิดแชทตอบกลับ'}).click();
  await read;
  await page.goBack();
  await expect(page.locator('.chat-card')).toHaveCount(unread - 1);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin-app-expo\/$/);
  await expect(page.getByRole('tab', {name: unread > 1 ? 'แชท ' + (unread - 1) + ' รายการ' : 'แชท', exact: true})).toBeVisible();
});

test('Expo explains missing order costs and the recent order detail returns to the Expo overview', async ({page}) => {
  await page.route('**/admin/v1/overview?include_mock=true', async route => {
    const response = await route.fetch();
    const summary = await response.json();
    await route.fulfill({
      response,
      json: {...summary, estimated_gross_profit_usd: null, missing_cost_count: 1},
    });
  }, {times: 1});
  await page.goto('/preview?ui=expo');
  const metrics = page.getByLabel('สถิติวันนี้');
  const profit = metrics.getByText('กำไรขั้นต้น', {exact: true}).locator('..');
  await expect(profit.getByText('ข้อมูลต้นทุนไม่ครบ', {exact: true})).toBeVisible();
  await expect(profit.getByText('—', {exact: true})).toBeVisible();
  await expect(profit.getByText('$0.00', {exact: true})).toHaveCount(0);
  const response = await page.request.get('/admin/v1/orders?limit=3&include_mock=true');
  expect(response.ok()).toBe(true);
  const recent = (await response.json()).data[0];
  const ref = /^SQ-\d+$/.test(recent.id) ? recent.id : recent.id.replaceAll('-', '').slice(-10);
  await page.getByRole('button', {name: new RegExp('#' + ref)}).click();
  const detail = page.getByRole('region', {name: 'รายละเอียดออเดอร์'});
  await expect(detail.getByRole('heading', {name: /รายละเอียดออเดอร์/})).toBeVisible();
  await expect(detail.getByText('#' + ref, {exact: true}).first()).toBeVisible();
  expect(new URL(page.url()).hash.split('?')[0]).toBe('#/orders/' + encodeURIComponent(recent.id));
  await page.getByRole('button', {name: 'ย้อนกลับ', exact: true}).click();
  await expect(page).toHaveURL(/\/admin-app-expo\/$/);
  await expect(page.getByRole('heading', {name: 'ภาพรวม'})).toBeVisible();
});

test('Expo waits for a real zero queue from the API before showing the empty state', async ({page}) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => {release = resolve;});
  await page.route(reviewPreview, async route => {await hold; await route.continue();});
  await page.goto('/preview?ui=expo');
  const metric = page.getByLabel('สถิติวันนี้').getByText('สลิปรอตรวจ', {exact: true}).locator('..');
  try {
    await expect(page.getByText('ระบบปกติ', {exact: true})).toBeVisible();
    await expect(metric.getByText('—', {exact: true})).toBeVisible();
    await expect(page.getByText('ไม่มีสลิปรอตรวจ', {exact: true})).toHaveCount(0);
    const ready = await page.request.get(reviewPath);
    expect(ready.ok()).toBe(true);
    const queue = await ready.json();
    expect(queue.counts.payment_review).toBeGreaterThan(0);
    const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'squid_admin_csrf')?.value;
    expect(csrf).toBeTruthy();
    // The Playwright server uses an isolated in-memory database without Telegram transport.
    for (const order of queue.data) {
      const response = await page.request.post('/admin/v1/orders/' + encodeURIComponent(order.id) + '/actions', {
        headers: {'x-csrf-token': csrf!, origin: new URL(page.url()).origin},
        data: {action: 'approve', expected_revision: order.revision, idempotency_key: crypto.randomUUID()},
      });
      expect(response.ok(), await response.text()).toBe(true);
    }
    const empty = await page.request.get(reviewPath);
    expect(empty.ok()).toBe(true);
    expect((await empty.json()).data).toEqual([]);
  } finally {
    release();
  }
  await expect(page.getByRole('button', {name: 'ไม่มีสลิปรอตรวจ', exact: true})).toBeVisible();
  await expect(metric.getByText('0', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'เปิดคิวตรวจสลิป'}).click();
  await expect(page.getByLabel('กรองสถานะ')).toHaveValue('payment_review');
  await expect(page.getByRole('heading', {name: 'ไม่พบออเดอร์ที่ตรงกัน'})).toBeVisible();
  await expect(page.locator('.order-card')).toHaveCount(0);
});

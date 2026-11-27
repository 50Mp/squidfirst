import {defineConfig} from '@playwright/test';

const origin = 'http://localhost:3120';
export default defineConfig({
  testDir: 'tests/miniapp-expo',
  outputDir: 'test-results/expo',
  use: {baseURL: origin, viewport: {width: 390, height: 924}, trace: 'retain-on-failure'},
  webServer: {
    command: 'node --import tsx tests/miniapp/server.ts --design-preview --expo-overview',
    env: {SQUID_DESIGN_PREVIEW_PORT: '3120'},
    url: origin + '/health',
    timeout: 60_000,
  },
});

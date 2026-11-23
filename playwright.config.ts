import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/miniapp',timeout:30000,fullyParallel:false,workers:1,use:{baseURL:'http://127.0.0.1:3101',headless:true,screenshot:'off',trace:'retain-on-failure'},webServer:{command:'node --import tsx tests/miniapp/server.ts',url:'http://127.0.0.1:3101/health',reuseExistingServer:false,timeout:60000},reporter:'list'});

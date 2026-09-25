import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/ui',timeout:30000,use:{baseURL:'http://127.0.0.1:4173',screenshot:'only-on-failure',trace:'retain-on-failure'},webServer:{command:'node dev-server.mjs',port:4173,reuseExistingServer:!process.env.CI},reporter:[['list'],['html',{open:'never'}]]});

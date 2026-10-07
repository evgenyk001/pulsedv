import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testMatch:'finance-mobile.spec.ts',use:{...config.use,browserName:'webkit',isMobile:true,hasTouch:true,deviceScaleFactor:3},reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report-finance-webkit'}]]});

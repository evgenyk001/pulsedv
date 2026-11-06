import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'/',plugins:[react()],publicDir:false,build:{outDir:fileURLToPath(new URL('../../../../giveaway-visual-qa/dist',import.meta.url)),emptyOutDir:true}});

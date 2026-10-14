import { defineConfig } from "vite";
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {renderPublicOffer} from '../../packages/partners/publicOffer';
import {OFFER_VERSION} from '../../packages/partners/offer';
import react from "@vitejs/plugin-react";
export default defineConfig({plugins:[react(),{name:'public-partner-offer',writeBundle(){const root=fileURLToPath(new URL('../../dist/partner-offer/',import.meta.url));mkdirSync(root,{recursive:true});writeFileSync(root+'index.html',renderPublicOffer());for(const version of [OFFER_VERSION,'partners-v1']){mkdirSync(root+version,{recursive:true});writeFileSync(root+version+'/index.html',renderPublicOffer(version))}}}],base:"/pulsedv/mini-app/",build:{outDir:"../../dist/mini-app",emptyOutDir:true}});

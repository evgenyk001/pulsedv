import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({plugins:[react()],base:"/pulsedv/mini-app/",build:{outDir:"../../dist/mini-app",emptyOutDir:true}});

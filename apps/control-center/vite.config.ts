import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins:[react()],
  base:"/pulsedv/control-center/",
  build:{outDir:"../../dist/control-center",emptyOutDir:true}
});

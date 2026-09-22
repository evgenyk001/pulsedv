import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/pulsedv/",
  plugins: [react()],
  server: { port: 4173 },
  preview: { port: 4173 }
});

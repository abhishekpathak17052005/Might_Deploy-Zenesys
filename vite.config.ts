import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  root: "frontend",
  plugins: [
    tanstackStart({
      srcDirectory: "src",
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
  ],
  resolve: { tsconfigPaths: true },
  server: { host: true, strictPort: false, hmr: { overlay: false } },
});

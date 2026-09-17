import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),

   
  ],

  build: {
    outDir: "dist",
    emptyOutDir: true,

    rollupOptions: {
      input: {
       sidepanel: resolve(
          rootDir,
          "sidepanel.html"
        ),  
        background: resolve(
          rootDir,
          "src/extension/background/service-worker.ts"
        ),
        content: resolve(
          rootDir,
          "src/extension/content/content-script.ts"
        ),
      },

      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") {
            return "background.js";
          }

          if (chunk.name === "content") {
            return "content.js";
          }

          return "[name].js";
        },

        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
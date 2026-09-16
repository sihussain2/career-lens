import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,

    rollupOptions: {
      input: resolve(
        __dirname,
        "src/extension/content/content-script.ts"
      ),

      output: {
        format: "iife",
        inlineDynamicImports: true,
        entryFileNames: "content.js"
      }
    }
  }
});

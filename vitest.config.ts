import { defineConfig } from "vite";
import { resolve } from "node:path";

if (command === "serve") {
  return {
    root: ".",          // project root, not demo/
    publicDir: resolve(__dirname, "fonts"),
    server: {
      port: 5173,
      open: "/index.html",
    },
  };
}

export default defineConfig(({ command }) => {
  // Dev server: serve the demo page with the engine as local imports.
  if (command === "serve") {
    return {
      root: "demo",
      publicDir: resolve(__dirname, "fonts"),
      server: {
        port: 5173,
        open: true,
      },
      resolve: {
        alias: {
          // Allow demo/main.ts to import ../src/... and resolve .js → .ts
        },
      },
    };
  }

  // Production build: bundle the library.
  return {
    build: {
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        formats: ["es"],
        fileName: () => "index.js",
      },
      rollupOptions: {
        output: {
          preserveModules: true,
          preserveModulesRoot: "src",
          entryFileNames: "[name].js",
        },
      },
    },
  };
});
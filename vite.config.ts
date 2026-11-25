import { defineConfig } from "vitest/config";
import { courseMarkdown } from "./src/content/vite-plugin";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/wenyan-app/" : "/",
  build: {
    rollupOptions: {
      output: {
        // UI-only releases can reuse the independently hashed course data.
        manualChunks(id) {
          if (id === "\0virtual:wenyan-course-questions")
            return "course-questions";
          if (id === "\0virtual:wenyan-course") return "course-data";
        },
      },
    },
  },
  plugins: [
    courseMarkdown(),
    vue(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        lang: "zh-CN",
        name: "文言拾阶 · 古文阅读练习",
        short_name: "文言拾阶",
        description: "从一句古文读到整篇。课程和复习都可以离线使用。",
        theme_color: "#5951d9",
        background_color: "#f8f9fc",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [192, 512].map((size) => ({
          src: `icon-${size}.png`,
          sizes: `${size}x${size}`,
          type: "image/png",
        })),
      },
      workbox: {
        // Keep the current page's lazy-loaded chunks until its last tab closes.
        skipWaiting: false,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,png,svg,webp,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  test: { include: ["tests/unit/**/*.test.ts"], environment: "jsdom" },
}));

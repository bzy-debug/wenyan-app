import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/wenyan-app/" : "/",
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        lang: "zh-CN",
        name: "文言拾阶 · 古文阅读练习",
        short_name: "文言拾阶",
        description: "分级学习文言文，离线练习与复习。",
        theme_color: "#225b46",
        background_color: "#faf9f5",
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
        globPatterns: ["**/*.{js,css,html,png,svg,webp,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  test: { include: ["tests/unit/**/*.test.ts"], environment: "jsdom" },
}));

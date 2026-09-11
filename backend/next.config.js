const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
      "@/routes": path.resolve(__dirname, "routes"),
      "@/controllers": path.resolve(__dirname, "controllers"),
      "@/middlewares": path.resolve(__dirname, "middlewares"),
      "@/models": path.resolve(__dirname, "models"),
      "@/db": path.resolve(__dirname, "db"),
      "@/utils": path.resolve(__dirname, "utils"),
    };
    return config;
  },
};

module.exports = nextConfig;

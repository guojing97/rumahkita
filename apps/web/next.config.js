/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@rumahkita/ui', '@rumahkita/contracts'],
  reactStrictMode: true,
};

module.exports = nextConfig;

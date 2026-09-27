/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.BASE_PATH || '',
  reactStrictMode: true,
  images: { unoptimized: true }
};

module.exports = nextConfig;

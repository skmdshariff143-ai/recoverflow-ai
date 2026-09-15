/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@recoverflow/core', '@recoverflow/agents', '@recoverflow/jobs'],
};

export default nextConfig;

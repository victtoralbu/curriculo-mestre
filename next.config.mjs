/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'bcryptjs'],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/**' },
    ],
    minimumCacheTTL: 2678400,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdf-parse tries to load test files via fs; ignore them
      config.resolve.alias['./test/unit/helpers/consolidate.js'] = false
    }
    return config
  },
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    outputFileTracingIncludes: {
      '/admin/manual': ['./MANUAL.md'],
    },
  },
};

export default nextConfig;

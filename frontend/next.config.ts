import withPWA from '@ducanh2912/next-pwa';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Next.js Image Optimization needs to be configured for static export or disabled,
  // we use unoptimized images for S3 static hosting.
  images: {
    unoptimized: true,
  },
};

const withPWAConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
});

export default withPWAConfig(nextConfig);

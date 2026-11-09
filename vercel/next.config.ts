import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  outputFileTracingRoot: path.resolve(import.meta.dirname, '..'),
  experimental: { externalDir: true },
  poweredByHeader: false,
};
export default config;

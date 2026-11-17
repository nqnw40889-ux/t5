const backend = new URL(process.env.AI4I_API_ORIGIN ?? '');

if (backend.protocol !== 'https:' || backend.href !== `${backend.origin}/`) {
  throw new Error('AI4I_API_ORIGIN phải là địa chỉ HTTPS gốc của API Render.');
}

export const config = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${backend.origin}/api/:path*`,
    },
  ],
};

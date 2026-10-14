const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').origin;
const developmentScriptSources = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${developmentScriptSources} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin} https://accounts.google.com https://api.cloudinary.com${process.env.NODE_ENV === 'production' ? '' : ' ws://localhost:*'}`,
  "media-src 'self' https:",
  "frame-src 'self' https://accounts.google.com https://accept.paymob.com",
  "form-action 'self' https://accept.paymob.com",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default nextConfig;

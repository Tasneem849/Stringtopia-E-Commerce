export default function robots() {
  const base = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${base.replace(/\/$/, '')}/sitemap.xml`,
  };
}

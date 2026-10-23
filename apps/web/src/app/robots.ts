import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://recoverflow-ai-kohl.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/demo',
          '/privacy',
          '/terms',
        ],
        disallow: [
          '/api/',
          '/login',
          '/overview',
          '/recovery/',
          '/commerce/',
          '/intelligence/',
          '/audit',
          '/operations',
          '/settings',
          '/team',
          '/customers',
          '/developers',
          '/policies',
          '/trigger/',
          '/ecommerce/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

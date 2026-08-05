import { createHash } from 'crypto';

/**
 * Helper to generate a SHA-256 hash from a normalized URL.
 * Matches the url_hash @db.Char(64) column.
 */
function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

export const data = {
  urls: [
    {
      id: 1n,
      shortCode: 'abc123',
      originalUrl: 'https://www.google.com/',
      normalizedUrl: 'https://www.google.com/',
      urlHash: hashUrl('https://www.google.com/'),
      clickCount: 142n,
      createdAt: new Date('2026-02-20T12:00:00.000Z'),
      expiresAt: null,
    },
    {
      id: 2n,
      shortCode: 'xyz789',
      originalUrl: 'https://github.com/nestjs/nest',
      normalizedUrl: 'https://github.com/nestjs/nest',
      urlHash: hashUrl('https://github.com/nestjs/nest'),
      clickCount: 87n,
      createdAt: new Date('2026-03-01T09:15:00.000Z'),
      expiresAt: null,
    },
    {
      id: 3n,
      shortCode: 'prsm42',
      originalUrl: 'https://www.prisma.io/docs/getting-started',
      normalizedUrl: 'https://www.prisma.io/docs/getting-started',
      urlHash: hashUrl('https://www.prisma.io/docs/getting-started'),
      clickCount: 56n,
      createdAt: new Date('2026-03-15T16:30:00.000Z'),
      expiresAt: null,
    },
    {
      id: 4n,
      shortCode: 'nxtjs1',
      originalUrl: 'https://nextjs.org/docs',
      normalizedUrl: 'https://nextjs.org/docs',
      urlHash: hashUrl('https://nextjs.org/docs'),
      clickCount: 203n,
      createdAt: new Date('2026-04-01T11:00:00.000Z'),
      expiresAt: null,
    },
    {
      id: 5n,
      shortCode: 'rdis01',
      originalUrl: 'https://redis.io/docs/latest/',
      normalizedUrl: 'https://redis.io/docs/latest/',
      urlHash: hashUrl('https://redis.io/docs/latest/'),
      clickCount: 31n,
      createdAt: new Date('2026-04-10T14:45:00.000Z'),
      expiresAt: null,
    },
    {
      id: 6n,
      shortCode: 'ts2026',
      originalUrl: 'https://www.typescriptlang.org/docs/',
      normalizedUrl: 'https://www.typescriptlang.org/docs/',
      urlHash: hashUrl('https://www.typescriptlang.org/docs/'),
      clickCount: 75n,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      expiresAt: null,
    },
    {
      id: 7n,
      shortCode: 'exp001',
      originalUrl: 'https://example.com/temporary-promo',
      normalizedUrl: 'https://example.com/temporary-promo',
      urlHash: hashUrl('https://example.com/temporary-promo'),
      clickCount: 15n,
      createdAt: new Date('2026-05-15T08:00:00.000Z'),
      expiresAt: new Date('2026-06-15T23:59:59.000Z'),
    },
    {
      id: 8n,
      shortCode: 'shr001',
      originalUrl: 'https://stackoverflow.com/questions/tagged/nestjs',
      normalizedUrl: 'https://stackoverflow.com/questions/tagged/nestjs',
      urlHash: hashUrl('https://stackoverflow.com/questions/tagged/nestjs'),
      clickCount: 64n,
      createdAt: new Date('2026-05-20T13:30:00.000Z'),
      expiresAt: null,
    },
  ],
};

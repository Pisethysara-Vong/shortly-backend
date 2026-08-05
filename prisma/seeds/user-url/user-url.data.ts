export const data = {
  userUrls: [
    // John Doe owns: Google, NestJS GitHub, Next.js docs
    {
      userId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      urlId: 1n, // google.com
      createdAt: new Date('2026-02-20T12:00:00.000Z'),
    },
    {
      userId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      urlId: 2n, // github.com/nestjs/nest
      createdAt: new Date('2026-03-01T09:15:00.000Z'),
    },
    {
      userId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      urlId: 4n, // nextjs.org/docs
      createdAt: new Date('2026-04-01T11:00:00.000Z'),
    },

    // Jane Smith owns: Google (shared with John — deduplication), Prisma docs
    {
      userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      urlId: 1n, // google.com (shared with John)
      createdAt: new Date('2026-03-12T10:00:00.000Z'),
    },
    {
      userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      urlId: 3n, // prisma.io/docs
      createdAt: new Date('2026-03-15T16:30:00.000Z'),
    },

    // Alice Wonder owns: Redis docs, TypeScript docs, expired promo link
    {
      userId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      urlId: 5n, // redis.io/docs
      createdAt: new Date('2026-04-10T14:45:00.000Z'),
    },
    {
      userId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      urlId: 6n, // typescriptlang.org/docs
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
    },
    {
      userId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      urlId: 7n, // example.com/temporary-promo (expired)
      createdAt: new Date('2026-05-15T08:00:00.000Z'),
    },

    // Bob Builder owns: StackOverflow NestJS, Next.js docs (shared with John — deduplication)
    {
      userId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      urlId: 8n, // stackoverflow.com/questions/tagged/nestjs
      createdAt: new Date('2026-05-20T13:30:00.000Z'),
    },
    {
      userId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      urlId: 4n, // nextjs.org/docs (shared with John)
      createdAt: new Date('2026-05-22T09:00:00.000Z'),
    },
  ],
};

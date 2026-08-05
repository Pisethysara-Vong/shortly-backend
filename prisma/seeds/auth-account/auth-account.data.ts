import { AuthEnum } from '../../../enums/auth.enum';

export const data = {
  authAccounts: [
    // Admin — LOCAL auth only
    {
      id: 'aa111111-1111-1111-1111-111111111111',
      userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      provider: AuthEnum.LOCAL,
      providerUserId: null,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$seedhashadmin000000000000$abcdefghijklmnopqrstuvwxyz012345',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      disabledAt: null,
    },
    // John Doe — LOCAL auth
    {
      id: 'aa222222-2222-2222-2222-222222222222',
      userId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      provider: AuthEnum.LOCAL,
      providerUserId: null,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$seedhashjohn0000000000000$abcdefghijklmnopqrstuvwxyz012345',
      createdAt: new Date('2026-02-15T10:30:00.000Z'),
      disabledAt: null,
    },
    // Jane Smith — GOOGLE auth (no password)
    {
      id: 'aa333333-3333-3333-3333-333333333333',
      userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      provider: AuthEnum.GOOGLE,
      providerUserId: '109876543210987654321',
      passwordHash: null,
      createdAt: new Date('2026-03-10T14:00:00.000Z'),
      disabledAt: null,
    },
    // Alice Wonder — LOCAL auth
    {
      id: 'aa444444-4444-4444-4444-444444444444',
      userId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      provider: AuthEnum.LOCAL,
      providerUserId: null,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$seedhashalice000000000000$abcdefghijklmnopqrstuvwxyz012345',
      createdAt: new Date('2026-04-20T08:45:00.000Z'),
      disabledAt: null,
    },
    // Bob Builder — LOCAL auth
    {
      id: 'aa555555-5555-5555-5555-555555555555',
      userId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      provider: AuthEnum.LOCAL,
      providerUserId: null,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$seedhashbob00000000000000$abcdefghijklmnopqrstuvwxyz012345',
      createdAt: new Date('2026-05-05T16:20:00.000Z'),
      disabledAt: null,
    },
  ],
};

import { RoleEnum } from '../../../enums/role.enum';

export const data = {
  users: [
    {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      email: 'admin@urlshortener.com',
      username: 'admin',
      profileImage: null,
      role: RoleEnum.ADMIN,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
    },
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      email: 'john.doe@example.com',
      username: 'johndoe',
      profileImage: null,
      role: RoleEnum.USER,
      createdAt: new Date('2026-02-15T10:30:00.000Z'),
      deletedAt: null,
    },
    {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      email: 'jane.smith@example.com',
      username: 'janesmith',
      profileImage: 'https://lh3.googleusercontent.com/a/default-user-photo',
      role: RoleEnum.USER,
      createdAt: new Date('2026-03-10T14:00:00.000Z'),
      deletedAt: null,
    },
    {
      id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      email: 'alice.wonder@example.com',
      username: 'alicew',
      profileImage: null,
      role: RoleEnum.USER,
      createdAt: new Date('2026-04-20T08:45:00.000Z'),
      deletedAt: null,
    },
    {
      id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      email: 'bob.builder@example.com',
      username: 'bobbuild',
      profileImage: null,
      role: RoleEnum.USER,
      createdAt: new Date('2026-05-05T16:20:00.000Z'),
      deletedAt: null,
    },
  ],
};

// ============================================================================
// URL SERVICE SPEC
// File: src/app/resources/r2-url/service.spec.ts
// ============================================================================
//
// Prisma is mocked; the real UrlService logic runs. normalizeUrl() and
// generateHash() are pure and deterministic, so they're tested directly
// with real inputs (no mocking needed). The short-code retry loop is
// tested by controlling what the mocked findUnique() reports on each
// call — we don't need to know the actual random code Prisma "generated"
// each attempt, only whether the DB says it collided.
//
// If all 10 short-code retry attempts collide, createUrl() now throws a
// clean ConflictException rather than silently proceeding to create() with
// a code that might still not be unique. See the "short code retry loop"
// describe block below for the tests locking that fix in.

jest.mock('../../../../prisma/client', () => ({
  prismaClient: {
    url: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    userUrl: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UrlService } from './service';
import { prismaClient } from '../../../../prisma/client';
import { RoleEnum } from '../../../../enums/role.enum';
import { CreateUrlDto } from './dto';

describe('UrlService', () => {
  let service: UrlService;

  const mockPrisma = prismaClient as unknown as {
    url: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    userUrl: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  const makeUrlRecord = (overrides: Record<string, any> = {}) => ({
    id: 123n,
    shortCode: 'abc1234',
    originalUrl: 'https://example.com/page',
    normalizedUrl: 'https://example.com/page',
    urlHash: 'hash-placeholder',
    clickCount: 0n,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlService],
    }).compile();

    service = module.get<UrlService>(UrlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ========================================================================
  // NORMALIZE URL (pure function — no mocks needed)
  // ========================================================================
  describe('normalizeUrl', () => {
    it('lowercases the protocol and host, but preserves path casing', () => {
      const result = service.normalizeUrl('HTTPS://Example.COM/MyPath');
      expect(result).toBe('https://example.com/MyPath');
    });

    it('strips a single trailing slash from a non-root path', () => {
      const result = service.normalizeUrl('https://example.com/path/');
      expect(result).toBe('https://example.com/path');
    });

    it('keeps a bare root path ("/") as-is (does not strip it to empty)', () => {
      const result = service.normalizeUrl('https://example.com/');
      expect(result).toBe('https://example.com/');
    });

    it('preserves the query string', () => {
      const result = service.normalizeUrl('https://example.com/search?q=cats&page=2');
      expect(result).toBe('https://example.com/search?q=cats&page=2');
    });

    it('trims surrounding whitespace before parsing', () => {
      const result = service.normalizeUrl('  https://example.com/page  ');
      expect(result).toBe('https://example.com/page');
    });

    it('falls back to the trimmed raw input when the URL cannot be parsed', () => {
      const result = service.normalizeUrl('   not a valid url   ');
      expect(result).toBe('not a valid url');
    });
  });

  // ========================================================================
  // GENERATE HASH (pure function — no mocks needed)
  // ========================================================================
  describe('generateHash', () => {
    it('returns the sha256 hex digest of the input string', () => {
      const input = 'https://example.com/page';
      const expected = crypto.createHash('sha256').update(input).digest('hex');

      expect(service.generateHash(input)).toBe(expected);
    });

    it('produces the same hash for the same input (deterministic)', () => {
      const a = service.generateHash('https://example.com/page');
      const b = service.generateHash('https://example.com/page');
      expect(a).toBe(b);
    });

    it('produces different hashes for different input', () => {
      const a = service.generateHash('https://example.com/page-a');
      const b = service.generateHash('https://example.com/page-b');
      expect(a).not.toBe(b);
    });
  });

  // ========================================================================
  // CREATE URL
  // ========================================================================
  describe('createUrl', () => {
    const dto: CreateUrlDto = { originalUrl: 'https://example.com/page' };

    it('deduplicates: if a URL with the same hash already exists, links it to the user instead of creating a new row', async () => {
      const existing = makeUrlRecord();
      mockPrisma.url.findUnique.mockResolvedValueOnce(existing); // hash lookup hits
      mockPrisma.userUrl.upsert.mockResolvedValueOnce({});

      const result = await service.createUrl('user-1', dto);

      expect(mockPrisma.userUrl.upsert).toHaveBeenCalledWith({
        where: { userId_urlId: { userId: 'user-1', urlId: existing.id } },
        create: { userId: 'user-1', urlId: existing.id },
        update: {},
      });
      expect(mockPrisma.url.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: '123',
        shortCode: existing.shortCode,
        originalUrl: existing.originalUrl,
        clickCount: 0,
        createdAt: existing.createdAt,
        expiresAt: null,
      });
    });

    it('creates a new URL row (with a unique short code found on the first try) when no matching hash exists', async () => {
      mockPrisma.url.findUnique
        .mockResolvedValueOnce(null) // hash lookup: no existing row
        .mockResolvedValueOnce(null); // shortCode uniqueness check: unique first try
      const created = makeUrlRecord();
      mockPrisma.url.create.mockResolvedValueOnce(created);

      const result = await service.createUrl('user-1', dto);

      expect(mockPrisma.url.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.url.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalUrl: dto.originalUrl,
            expiresAt: null,
            users: { create: { userId: 'user-1' } },
          }),
        }),
      );
      expect(mockPrisma.userUrl.upsert).not.toHaveBeenCalled();
      expect(result.id).toBe('123');
    });

    it('converts a provided expiresAt ISO string into a Date before storing', async () => {
      mockPrisma.url.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockPrisma.url.create.mockResolvedValueOnce(makeUrlRecord());

      await service.createUrl('user-1', {
        originalUrl: 'https://example.com/page',
        expiresAt: '2027-01-01T00:00:00.000Z',
      });

      expect(mockPrisma.url.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: new Date('2027-01-01T00:00:00.000Z'),
          }),
        }),
      );
    });

    describe('short code retry loop', () => {
      it('retries on a short-code collision and succeeds once a unique code is found', async () => {
        mockPrisma.url.findUnique
          .mockResolvedValueOnce(null) // hash lookup: no existing row
          .mockResolvedValueOnce(makeUrlRecord({ shortCode: 'taken11' })) // attempt 1: collision
          .mockResolvedValueOnce(null); // attempt 2: unique
        mockPrisma.url.create.mockResolvedValueOnce(makeUrlRecord());

        await service.createUrl('user-1', dto);

        // 1 hash check + 2 shortCode checks = 3 findUnique calls total
        expect(mockPrisma.url.findUnique).toHaveBeenCalledTimes(3);
        expect(mockPrisma.url.create).toHaveBeenCalledTimes(1);
      });

      it('throws ConflictException after exhausting all 10 retry attempts (all collisions), and never calls create()', async () => {
        mockPrisma.url.findUnique.mockResolvedValueOnce(null); // hash lookup: no existing row
        for (let i = 0; i < 10; i++) {
          mockPrisma.url.findUnique.mockResolvedValueOnce(
            makeUrlRecord({ shortCode: `taken${i}` }),
          ); // every one of the 10 attempts collides
        }

        const err = await service.createUrl('user-1', dto).catch((e) => e);

        // 1 hash check + 10 shortCode collision checks = 11 findUnique calls
        expect(mockPrisma.url.findUnique).toHaveBeenCalledTimes(11);
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.message).toBe(
          'Could not generate a unique short code. Please try again.',
        );
        expect(mockPrisma.url.create).not.toHaveBeenCalled();
      });
    });
  });

  // ========================================================================
  // GET USER URLs
  // ========================================================================
  describe('getUserUrls', () => {
    it('returns the formatted list of the given user\'s urls, most recent first', async () => {
      mockPrisma.userUrl.findMany.mockResolvedValueOnce([
        { url: makeUrlRecord({ id: 1n, shortCode: 'code1' }) },
        { url: makeUrlRecord({ id: 2n, shortCode: 'code2' }) },
      ]);

      const result = await service.getUserUrls('user-1');

      expect(mockPrisma.userUrl.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { url: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('returns an empty array when the user has no urls', async () => {
      mockPrisma.userUrl.findMany.mockResolvedValueOnce([]);

      const result = await service.getUserUrls('user-1');

      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // GET URL BY ID
  // ========================================================================
  describe('getUrlById', () => {
    it('rejects with BadRequestException for a non-numeric id, without touching the database', async () => {
      const err = await service
        .getUrlById('user-1', RoleEnum.USER, 'not-a-number')
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Invalid URL ID format');
      expect(mockPrisma.url.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.userUrl.findUnique).not.toHaveBeenCalled();
    });

    it('admin: looks up the url directly by id (no ownership check)', async () => {
      mockPrisma.url.findUnique.mockResolvedValueOnce(makeUrlRecord({ id: 123n }));

      const result = await service.getUrlById('any-admin-id', RoleEnum.ADMIN, '123');

      expect(mockPrisma.url.findUnique).toHaveBeenCalledWith({ where: { id: 123n } });
      expect(mockPrisma.userUrl.findUnique).not.toHaveBeenCalled();
      expect(result.id).toBe('123');
    });

    it('admin: rejects with the generic NotFoundException message when the url does not exist at all', async () => {
      mockPrisma.url.findUnique.mockResolvedValueOnce(null);

      const err = await service
        .getUrlById('any-admin-id', RoleEnum.ADMIN, '999')
        .catch((e) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect(err.message).toBe('URL not found');
    });

    it('regular user: looks up via the userUrl ownership join, not the url table directly', async () => {
      mockPrisma.userUrl.findUnique.mockResolvedValueOnce({
        url: makeUrlRecord({ id: 123n }),
      });

      const result = await service.getUrlById('user-1', RoleEnum.USER, '123');

      expect(mockPrisma.userUrl.findUnique).toHaveBeenCalledWith({
        where: { userId_urlId: { userId: 'user-1', urlId: 123n } },
        include: { url: true },
      });
      expect(mockPrisma.url.findUnique).not.toHaveBeenCalled();
      expect(result.id).toBe('123');
    });

    it('regular user: rejects with the access-denied-flavored message (distinct from the admin not-found message) when the url is missing or not theirs', async () => {
      mockPrisma.userUrl.findUnique.mockResolvedValueOnce(null);

      const err = await service
        .getUrlById('user-1', RoleEnum.USER, '999')
        .catch((e) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect(err.message).toBe('URL not found or access denied');
    });
  });

  // ========================================================================
  // DELETE URL
  // ========================================================================
  describe('deleteUrl', () => {
    it('rejects with BadRequestException for a non-numeric id, without touching the database', async () => {
      const err = await service.deleteUrl('user-1', 'not-a-number').catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toBe('Invalid URL ID format');
      expect(mockPrisma.userUrl.findUnique).not.toHaveBeenCalled();
    });

    it('rejects with NotFoundException when the url is not linked to this user\'s account', async () => {
      mockPrisma.userUrl.findUnique.mockResolvedValueOnce(null);

      const err = await service.deleteUrl('user-1', '123').catch((e) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      expect(err.message).toBe('URL not found in your account');
      expect(mockPrisma.userUrl.delete).not.toHaveBeenCalled();
    });

    it('unlinks the url from the user, and deletes the underlying url row too when no other user references it', async () => {
      mockPrisma.userUrl.findUnique.mockResolvedValueOnce({ userId: 'user-1', urlId: 123n });
      mockPrisma.userUrl.delete.mockResolvedValueOnce({});
      mockPrisma.userUrl.count.mockResolvedValueOnce(0);
      mockPrisma.url.delete.mockResolvedValueOnce({});

      const result = await service.deleteUrl('user-1', '123');

      expect(mockPrisma.userUrl.delete).toHaveBeenCalledWith({
        where: { userId_urlId: { userId: 'user-1', urlId: 123n } },
      });
      expect(mockPrisma.userUrl.count).toHaveBeenCalledWith({ where: { urlId: 123n } });
      expect(mockPrisma.url.delete).toHaveBeenCalledWith({ where: { id: 123n } });
      expect(result).toEqual({ message: 'URL removed from your account successfully' });
    });

    it('unlinks the url from the user but keeps the underlying url row when other users still reference it', async () => {
      mockPrisma.userUrl.findUnique.mockResolvedValueOnce({ userId: 'user-1', urlId: 123n });
      mockPrisma.userUrl.delete.mockResolvedValueOnce({});
      mockPrisma.userUrl.count.mockResolvedValueOnce(2); // 2 other users still have it saved

      const result = await service.deleteUrl('user-1', '123');

      expect(mockPrisma.userUrl.delete).toHaveBeenCalledTimes(1);
      expect(mockPrisma.url.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'URL removed from your account successfully' });
    });
  });

  // ========================================================================
  // ADMIN: GET ALL URLs
  // ========================================================================
  describe('getAllUrlsAdmin', () => {
    it('returns every url, formatted, ordered most-recent-first', async () => {
      mockPrisma.url.findMany.mockResolvedValueOnce([
        makeUrlRecord({ id: 1n }),
        makeUrlRecord({ id: 2n }),
      ]);

      const result = await service.getAllUrlsAdmin();

      expect(mockPrisma.url.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when there are no urls', async () => {
      mockPrisma.url.findMany.mockResolvedValueOnce([]);

      const result = await service.getAllUrlsAdmin();

      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // ADMIN: GET URLs FOR SPECIFIC USER
  // ========================================================================
  describe('getUserUrlsAdmin', () => {
    it("returns the target user's urls, formatted, most-recent-first", async () => {
      mockPrisma.userUrl.findMany.mockResolvedValueOnce([
        { url: makeUrlRecord({ id: 1n }) },
      ]);

      const result = await service.getUserUrlsAdmin('target-user-id');

      expect(mockPrisma.userUrl.findMany).toHaveBeenCalledWith({
        where: { userId: 'target-user-id' },
        include: { url: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });
});
// ============================================================================
// REDIRECT SERVICE SPEC
// File: src/app/resources/r3-redirect/service.spec.ts
// ============================================================================
//
// Prisma is mocked; the real RedirectService logic runs. Covers: not-found
// handling, expiry handling (both on a fresh DB read and on a cache hit),
// click-count incrementing, and the in-memory cache actually being used on
// a second lookup (no second DB read).
//
// Note: RedirectService has no constructor dependencies, so `new
// RedirectService()` would work just as well as going through Nest's
// TestingModule. We use TestingModule anyway for consistency with the
// rest of this project's test files — either is fine here.

jest.mock('../../../../prisma/client', () => ({
  prismaClient: {
    url: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { GoneException, NotFoundException } from '@nestjs/common';
import { RedirectService } from './service';
import { prismaClient } from '../../../../prisma/client';

describe('RedirectService', () => {
  let service: RedirectService;

  const mockPrisma = prismaClient as unknown as {
    url: { findUnique: jest.Mock; update: jest.Mock };
  };

  const makeUrlRecord = (overrides: Record<string, any> = {}) => ({
    id: 1n,
    shortCode: 'abc123',
    originalUrl: 'https://example.com/some/long/page',
    normalizedUrl: 'https://example.com/some/long/page',
    urlHash: 'a'.repeat(64),
    clickCount: 0n,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedirectService],
    }).compile();

    // A fresh RedirectService instance means a fresh (empty) in-memory
    // cache for every test — no leakage between test cases.
    service = module.get<RedirectService>(RedirectService);
    mockPrisma.url.update.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws NotFoundException when the short code does not exist, and never touches clickCount', async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce(null);

    const err = await service.resolveAndIncrement('nope').catch((e) => e);

    expect(err).toBeInstanceOf(NotFoundException);
    expect(err.message).toBe('Short URL not found');
    expect(mockPrisma.url.update).not.toHaveBeenCalled();
  });

  it('resolves a non-expired short code, returns its original URL, and increments the click count', async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce(makeUrlRecord());

    const result = await service.resolveAndIncrement('abc123');

    expect(result).toBe('https://example.com/some/long/page');
    expect(mockPrisma.url.update).toHaveBeenCalledWith({
      where: { shortCode: 'abc123' },
      data: { clickCount: { increment: 1 } },
    });
  });

  it('resolves a short code with expiresAt in the future (not yet expired)', async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce(
      makeUrlRecord({ expiresAt: new Date(Date.now() + 60_000) }),
    );

    const result = await service.resolveAndIncrement('abc123');

    expect(result).toBe('https://example.com/some/long/page');
    expect(mockPrisma.url.update).toHaveBeenCalledTimes(1);
  });

  it('throws GoneException when the short code has expired, and does NOT increment the click count', async () => {
    mockPrisma.url.findUnique.mockResolvedValueOnce(
      makeUrlRecord({ expiresAt: new Date(Date.now() - 60_000) }),
    );

    const err = await service.resolveAndIncrement('abc123').catch((e) => e);

    expect(err).toBeInstanceOf(GoneException);
    expect(err.message).toBe('Short URL has expired');
    expect(mockPrisma.url.update).not.toHaveBeenCalled();
  });

  describe('in-memory cache', () => {
    it('does not hit the database again on a second lookup of the same short code', async () => {
      mockPrisma.url.findUnique.mockResolvedValueOnce(makeUrlRecord());

      await service.resolveAndIncrement('abc123');
      await service.resolveAndIncrement('abc123');

      expect(mockPrisma.url.findUnique).toHaveBeenCalledTimes(1);
    });

    it('still increments the click count on every call, even when served from cache', async () => {
      mockPrisma.url.findUnique.mockResolvedValueOnce(makeUrlRecord());

      await service.resolveAndIncrement('abc123');
      await service.resolveAndIncrement('abc123');
      await service.resolveAndIncrement('abc123');

      expect(mockPrisma.url.update).toHaveBeenCalledTimes(3);
    });

    it('enforces expiry from cached data too, without needing a fresh DB read', async () => {
      // Cached while still valid...
      mockPrisma.url.findUnique.mockResolvedValueOnce(
        makeUrlRecord({ expiresAt: new Date(Date.now() + 200) }),
      );
      const firstResult = await service.resolveAndIncrement('abc123');
      expect(firstResult).toBe('https://example.com/some/long/page');

      // ...then time passes and it expires. Second call must reject using
      // the cached expiresAt, without calling findUnique again.
      jest.useFakeTimers().setSystemTime(Date.now() + 500);

      const err = await service.resolveAndIncrement('abc123').catch((e) => e);

      expect(err).toBeInstanceOf(GoneException);
      expect(mockPrisma.url.findUnique).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('caches independently per short code', async () => {
      mockPrisma.url.findUnique
        .mockResolvedValueOnce(makeUrlRecord({ shortCode: 'aaa111', originalUrl: 'https://a.com' }))
        .mockResolvedValueOnce(makeUrlRecord({ shortCode: 'bbb222', originalUrl: 'https://b.com' }));

      const first = await service.resolveAndIncrement('aaa111');
      const second = await service.resolveAndIncrement('bbb222');

      expect(first).toBe('https://a.com');
      expect(second).toBe('https://b.com');
      expect(mockPrisma.url.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
// ============================================================================
// REDIRECT SERVICE
// File: src/app/resources/r3-redirect/service.ts
// ============================================================================

import {
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prismaClient } from '../../../../prisma/client';

@Injectable()
export class RedirectService {
  private cache = new Map<
    string,
    { originalUrl: string; expiresAt: Date | null }
  >();

  resetCache(): void {
    this.cache.clear();
  }

  async resolveAndIncrement(shortCode: string): Promise<string> {
    let cached = this.cache.get(shortCode);
    let originalUrl: string;
    let expiresAt: Date | null = null;

    if (cached) {
      originalUrl = cached.originalUrl;
      expiresAt = cached.expiresAt;
    } else {
      const url = await prismaClient.url.findUnique({
        where: { shortCode },
      });

      if (!url) {
        throw new NotFoundException('Short URL not found');
      }

      originalUrl = url.originalUrl;
      expiresAt = url.expiresAt;

      // Store in cache
      this.cache.set(shortCode, { originalUrl, expiresAt });
    }

    // Check if expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw new GoneException('Short URL has expired');
    }

    // Atomically increment click count in database
    await prismaClient.url.update({
      where: { shortCode },
      data: {
        clickCount: { increment: 1 },
      },
    });

    return originalUrl;
  }
}

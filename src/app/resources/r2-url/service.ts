// ============================================================================
// URL SERVICE
// File: src/app/resources/r2-url/service.ts
// ============================================================================

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { prismaClient } from '../../../../prisma/client';
import { RoleEnum } from '../../../../enums/role.enum';
import { CreateUrlDto, UrlResponse } from './dto';

@Injectable()
export class UrlService {
  // ========================================================================
  // URL NORMALIZATION & HASHING
  // ========================================================================
  normalizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl.trim());
      let pathname = parsed.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
    } catch {
      return rawUrl.trim();
    }
  }

  generateHash(normalizedUrl: string): string {
    return crypto.createHash('sha256').update(normalizedUrl).digest('hex');
  }

  private generateShortCode(length = 7): string {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  private formatUrl(url: {
    id: bigint;
    shortCode: string;
    originalUrl: string;
    clickCount: bigint;
    createdAt: Date;
    expiresAt: Date | null;
  }): UrlResponse {
    return {
      id: url.id.toString(),
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
      clickCount: Number(url.clickCount),
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
    };
  }

  // ========================================================================
  // CREATE URL (with deduplication)
  // ========================================================================
  async createUrl(userId: string, dto: CreateUrlDto): Promise<UrlResponse> {
    const normalizedUrl = this.normalizeUrl(dto.originalUrl);
    const urlHash = this.generateHash(normalizedUrl);

    let existingUrl = await prismaClient.url.findUnique({
      where: { urlHash },
    });

    if (existingUrl) {
      await prismaClient.userUrl.upsert({
        where: {
          userId_urlId: {
            userId,
            urlId: existingUrl.id,
          },
        },
        create: {
          userId,
          urlId: existingUrl.id,
        },
        update: {},
      });

      return this.formatUrl(existingUrl);
    }

    let shortCode = this.generateShortCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const existingCode = await prismaClient.url.findUnique({
        where: { shortCode },
      });
      if (!existingCode) {
        isUnique = true;
      } else {
        shortCode = this.generateShortCode();
      }
    }

    const newUrl = await prismaClient.url.create({
      data: {
        shortCode,
        originalUrl: dto.originalUrl,
        normalizedUrl,
        urlHash,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        users: {
          create: {
            userId,
          },
        },
      },
    });

    return this.formatUrl(newUrl);
  }

  // ========================================================================
  // GET USER URLs (Authenticated User)
  // ========================================================================
  async getUserUrls(userId: string): Promise<UrlResponse[]> {
    const userUrls = await prismaClient.userUrl.findMany({
      where: { userId },
      include: { url: true },
      orderBy: { createdAt: 'desc' },
    });

    return userUrls.map((uu) => this.formatUrl(uu.url));
  }

  // ========================================================================
  // GET URL BY ID
  // ========================================================================
  async getUrlById(
    userId: string,
    role: string,
    urlIdStr: string,
  ): Promise<UrlResponse> {
    let urlId: bigint;
    try {
      urlId = BigInt(urlIdStr);
    } catch {
      throw new BadRequestException('Invalid URL ID format');
    }

    if (role === RoleEnum.ADMIN) {
      const url = await prismaClient.url.findUnique({
        where: { id: urlId },
      });
      if (!url) {
        throw new NotFoundException('URL not found');
      }
      return this.formatUrl(url);
    }

    const userUrl = await prismaClient.userUrl.findUnique({
      where: {
        userId_urlId: {
          userId,
          urlId,
        },
      },
      include: { url: true },
    });

    if (!userUrl) {
      throw new NotFoundException('URL not found or access denied');
    }

    return this.formatUrl(userUrl.url);
  }

  // ========================================================================
  // DELETE URL (Remove user relationship)
  // ========================================================================
  async deleteUrl(
    userId: string,
    urlIdStr: string,
  ): Promise<{ message: string }> {
    let urlId: bigint;
    try {
      urlId = BigInt(urlIdStr);
    } catch {
      throw new BadRequestException('Invalid URL ID format');
    }

    const existingUserUrl = await prismaClient.userUrl.findUnique({
      where: {
        userId_urlId: {
          userId,
          urlId,
        },
      },
    });

    if (!existingUserUrl) {
      throw new NotFoundException('URL not found in your account');
    }

    await prismaClient.userUrl.delete({
      where: {
        userId_urlId: {
          userId,
          urlId,
        },
      },
    });

    const remainingCount = await prismaClient.userUrl.count({
      where: { urlId },
    });

    if (remainingCount === 0) {
      await prismaClient.url.delete({
        where: { id: urlId },
      });
    }

    return { message: 'URL removed from your account successfully' };
  }

  // ========================================================================
  // ADMIN: GET ALL URLs
  // ========================================================================
  async getAllUrlsAdmin(): Promise<UrlResponse[]> {
    const urls = await prismaClient.url.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return urls.map((u) => this.formatUrl(u));
  }

  // ========================================================================
  // ADMIN: GET URLs FOR SPECIFIC USER
  // ========================================================================
  async getUserUrlsAdmin(targetUserId: string): Promise<UrlResponse[]> {
    const userUrls = await prismaClient.userUrl.findMany({
      where: { userId: targetUserId },
      include: { url: true },
      orderBy: { createdAt: 'desc' },
    });

    return userUrls.map((uu) => this.formatUrl(uu.url));
  }
}

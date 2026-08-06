// ============================================================================
// URL DTOs
// File: src/app/resources/r2-url/dto.ts
// ============================================================================

import { IsDateString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateUrlDto {
  @IsNotEmpty({ message: 'Original URL is required' })
  @IsUrl({}, { message: 'Invalid URL format' })
  originalUrl: string;

  @IsOptional()
  @IsDateString({}, { message: 'expiresAt must be a valid ISO date string' })
  expiresAt?: string;
}

export interface UrlResponse {
  id: string;
  shortCode: string;
  originalUrl: string;
  clickCount: number;
  createdAt: Date | string;
  expiresAt: Date | string | null;
}

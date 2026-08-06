// ============================================================================
// AUTH DTOs
// File: src/app/resources/r1-account/dto.ts
// ============================================================================

import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

// ========================================================================
// REGISTER DTO
// ========================================================================
export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Username must be at least 2 characters' })
  username: string;
}

// ========================================================================
// LOGIN DTO
// ========================================================================
export class LoginDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @IsString()
  password: string;
}

// ========================================================================
// GOOGLE AUTH DTO
// ========================================================================
export class GoogleAuthDto {
  @IsString()
  idToken: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  role: string;
  profileImage?: string | null;
  createdAt?: Date | string;
}

// tokens no longer live in the response body — refreshToken goes into
// an httpOnly cookie, accessToken is returned directly
export interface AuthResponse {
  message: string;
  user?: UserResponse;
  accessToken?: string;
}
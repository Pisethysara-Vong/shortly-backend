// ============================================================================
// AUTH SERVICE SPEC
// File: src/app/resources/r1-account/service.spec.ts
// ============================================================================
//
// Unlike controller.spec.ts, this file mocks the *dependencies* (Prisma,
// bcrypt, the Google OAuth client) rather than the service itself, so the
// real AuthService logic runs and gets verified: password hashing, the
// one-email-one-provider collision rules, token rotation, cookie settings,
// and error messages.
//
// These tests are written against the INTENDED contract as discussed, not
// reverse-engineered from the current implementation. Where a test fails
// against the current code, that's the point — it's flagging a real
// mismatch, not a mistake in the test.
//
// SECURITY NOTE: googleAuth() previously had an unverified-token fallback —
// if Google signature verification failed, it would blindly decode the
// token's claims (no signature check) and log the person in anyway. That's
// been removed; see the "invalid / unverifiable tokens are always rejected"
// block below for the tests that lock in the fix. jwtService.decode() must
// never be called anywhere in googleAuth() — several tests assert that
// explicitly, so a regression that reintroduces the fallback will fail loudly.
// ============================================================================

jest.mock('../../../../prisma/client', () => ({
  prismaClient: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// google-auth-library's OAuth2Client is instantiated in the service
// constructor (`new OAuth2Client(...)`). We mock the whole module and share
// one jest.fn() for verifyIdToken so tests can control it regardless of
// which AuthService/OAuth2Client instance calls it. (Variable must be
// prefixed "mock" — that's a hard Jest/Babel hoisting requirement for
// referencing outer variables inside jest.mock factories.)
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { type Response } from 'express';
import { AuthService } from './service';
import { prismaClient } from '../../../../prisma/client';
import { RoleEnum } from '../../../../enums/role.enum';
import { AuthEnum } from '../../../../enums/auth.enum';
import { RegisterDto, LoginDto, GoogleAuthDto } from './dto';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockPrisma = prismaClient as unknown as {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  // --------------------------------------------------------------------
  // Mock data builders, shaped per the prisma schema
  // --------------------------------------------------------------------
  const makeUser = (overrides: Record<string, any> = {}) => ({
    id: 'user-uuid-1',
    email: 'emailA@gmail.com',
    username: 'emailA',
    profileImage: null,
    role: RoleEnum.USER,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    authAccounts: [],
    ...overrides,
  });

  const localAccount = (overrides: Record<string, any> = {}) => ({
    id: 'auth-account-local',
    userId: 'user-uuid-1',
    provider: AuthEnum.LOCAL,
    providerUserId: null,
    passwordHash: 'stored-hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    disabledAt: null,
    ...overrides,
  });

  const googleAccount = (overrides: Record<string, any> = {}) => ({
    id: 'auth-account-google',
    userId: 'user-uuid-1',
    provider: AuthEnum.GOOGLE,
    providerUserId: 'google-sub-123',
    passwordHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    disabledAt: null,
    ...overrides,
  });

  const defaultConfig: Record<string, string> = {
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    JWT_SECRET: 'test-secret',
    NODE_ENV: 'test',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => defaultConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Sane default so tests that don't care about exact token contents
    // still get distinguishable access/refresh strings.
    jwtService.signAsync.mockImplementation(
      async (payload: any) => `signed.${payload.type}.token`,
    );
  });

  // ========================================================================
  // REGISTER
  // ========================================================================
  describe('register', () => {
    const dto: RegisterDto = {
      email: 'new@x.com',
      password: 'password123',
      username: 'newuser',
    };

    it('rejects with a Google-specific message when the email already has a Google-only account (does not create a duplicate)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ email: dto.email, authAccounts: [googleAccount()] }),
      );

      const err = await service.register(dto, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message).toBe(
        'This email is already registered via Google. Please sign in with Google instead.',
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects with the generic conflict message when the email already has a local account', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ email: dto.email, authAccounts: [localAccount()] }),
      );

      const err = await service.register(dto, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message).toBe('An account with this email already exists.');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects with the generic message (not the Google-specific one) when the email already has BOTH providers linked', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({
          email: dto.email,
          authAccounts: [localAccount(), googleAccount()],
        }),
      );

      const err = await service.register(dto, mockRes).catch((e) => e);

      expect(err.message).toBe('An account with this email already exists.');
    });

    it('hashes the password before storing it — never stores or returns the plaintext', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password-123');
      mockPrisma.user.create.mockResolvedValueOnce(
        makeUser({
          email: dto.email,
          username: dto.username,
          authAccounts: [
            localAccount({ passwordHash: 'hashed-password-123' }),
          ],
        }),
      );

      await service.register(dto, mockRes);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: dto.email,
            username: dto.username,
            role: RoleEnum.USER,
            authAccounts: {
              create: {
                provider: AuthEnum.LOCAL,
                passwordHash: 'hashed-password-123',
              },
            },
          }),
        }),
      );
    });

    it('on success: returns a message + user + accessToken, sets the refresh cookie, and never leaks the password hash or a tokens object in the response body', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password-123');
      const createdUser = makeUser({
        email: dto.email,
        username: dto.username,
        authAccounts: [
          localAccount({ passwordHash: 'hashed-password-123' }),
        ],
      });
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);

      const result = await service.register(dto, mockRes);

      expect(result.message).toBe('User registered successfully');
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user).toMatchObject({
        id: createdUser.id,
        email: createdUser.email,
        username: createdUser.username,
        role: createdUser.role,
      });
      expect((result as any).tokens).toBeUndefined();
      expect((result as any).refreshToken).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('hashed-password-123');

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
      );
    });
  });

  // ========================================================================
  // LOGIN
  // ========================================================================
  describe('login', () => {
    const dto: LoginDto = { email: 'emailA@gmail.com', password: 'correct-pw' };

    it('rejects with a generic message when no user exists for the email (does not reveal whether the email is registered)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('Invalid email or password');
    });

    it('rejects with the same generic message for a soft-deleted account (does not reveal deletion status)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ deletedAt: new Date(), authAccounts: [localAccount()] }),
      );

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(err.message).toBe('Invalid email or password');
    });

    it('rejects with a Google-specific message when the account exists only via Google', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [googleAccount()] }),
      );

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe(
        'This email is registered with Google. Please sign in with Google instead.',
      );
    });

    it('rejects with the generic message (not the Google-specific one) if the account has no linked providers at all', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [] }),
      );

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(err.message).toBe('Invalid email or password');
    });

    it('rejects with the generic message when the local account is disabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [localAccount({ disabledAt: new Date() })] }),
      );

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(err.message).toBe('Invalid email or password');
    });

    it('rejects with the generic message and does not attempt a bcrypt comparison when the local account has no password hash set', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [localAccount({ passwordHash: null })] }),
      );

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(err.message).toBe('Invalid email or password');
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects with the generic message when the password does not match', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [localAccount({ passwordHash: 'stored-hash' })] }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const err = await service.login(dto, mockRes).catch((e) => e);

      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, 'stored-hash');
      expect(err.message).toBe('Invalid email or password');
    });

    it('on success: returns a message + user + accessToken, sets the refresh cookie, and never leaks the password hash', async () => {
      const user = makeUser({
        authAccounts: [localAccount({ passwordHash: 'stored-hash' })],
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      const result = await service.login(dto, mockRes);

      expect(result.message).toBe('Login successful');
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user).toMatchObject({ id: user.id, email: user.email });
      expect(JSON.stringify(result)).not.toContain('stored-hash');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('gives byte-for-byte identical error messages for "no such email" and "wrong password" (prevents user enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      const noEmailErr = await service.login(dto, mockRes).catch((e) => e);

      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [localAccount({ passwordHash: 'stored-hash' })] }),
      );
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      const wrongPwErr = await service
        .login({ ...dto, password: 'nope' }, mockRes)
        .catch((e) => e);

      expect(noEmailErr.message).toBe(wrongPwErr.message);
    });
  });

  // ========================================================================
  // GOOGLE AUTH
  // ========================================================================
  describe('googleAuth', () => {
    const dto: GoogleAuthDto = { idToken: 'valid-google-id-token' };

    const mockGooglePayload = (
      overrides: Record<string, any> = {},
    ) => ({
      email: 'brandnew@x.com',
      sub: 'google-sub-1',
      name: undefined,
      picture: undefined,
      ...overrides,
    });

    it('creates a new Google-linked user when no account exists for the email, deriving username from the email when no name is provided', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => mockGooglePayload(),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(
        makeUser({
          email: 'brandnew@x.com',
          username: 'brandnew',
          authAccounts: [googleAccount({ providerUserId: 'google-sub-1' })],
        }),
      );

      const result = await service.googleAuth(dto, mockRes);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'brandnew@x.com',
            username: 'brandnew',
            role: RoleEnum.USER,
            authAccounts: {
              create: { provider: AuthEnum.GOOGLE, providerUserId: 'google-sub-1' },
            },
          }),
        }),
      );
      expect(result.message).toBe('Google authentication successful');
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('uses the Google profile name and picture when provided, instead of deriving them', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () =>
          mockGooglePayload({
            email: 'jane@x.com',
            sub: 'google-sub-2',
            name: 'Jane Doe',
            picture: 'https://pic.example/jane.png',
          }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(
        makeUser({ email: 'jane@x.com', username: 'Jane Doe' }),
      );

      await service.googleAuth(dto, mockRes);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'Jane Doe',
            profileImage: 'https://pic.example/jane.png',
          }),
        }),
      );
    });

    it('rejects (does NOT auto-link) when the email already has a local-only account', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => mockGooglePayload({ email: 'emailA@gmail.com', sub: 'google-sub-3' }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [localAccount()] }),
      );

      const err = await service.googleAuth(dto, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe(
        'This email is already registered. Please sign in with your email and password instead.',
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('logs in successfully when the user already has this Google account linked (no error, no duplicate creation)', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () =>
          mockGooglePayload({ email: 'emailA@gmail.com', sub: 'google-sub-123' }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ authAccounts: [googleAccount({ providerUserId: 'google-sub-123' })] }),
      );

      const result = await service.googleAuth(dto, mockRes);

      expect(result.message).toBe('Google authentication successful');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects when the matched account has been soft-deleted', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => mockGooglePayload({ email: 'gone@x.com', sub: 'google-sub-4' }),
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({
          email: 'gone@x.com',
          deletedAt: new Date(),
          authAccounts: [googleAccount()],
        }),
      );

      const err = await service.googleAuth(dto, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('This account has been deleted');
    });

    // ----------------------------------------------------------------
    // Invalid / unverifiable tokens are always rejected — no fallback
    // ----------------------------------------------------------------
    // Locks in the fix for the auth-bypass that used to exist here: a
    // token that fails real Google signature verification must be
    // rejected outright, never decoded-and-trusted as a fallback. Every
    // test in this block also asserts jwtService.decode() was never
    // called, so a regression that reintroduces the old fallback fails
    // immediately and loudly, not just via a behavior mismatch.
    describe('invalid / unverifiable tokens are always rejected (no fallback)', () => {
      it('rejects with a generic message when Google signature verification throws — e.g. a forged token with a victim email but a bad/wrong-audience signature — WITHOUT falling back to unverified decoding', async () => {
        // Simulates an attacker-supplied token that fails real Google
        // signature verification (wrong audience, bad signature, expired,
        // malformed, etc). Even if this token's claims contain a real
        // victim's email, it must never be trusted.
        mockVerifyIdToken.mockRejectedValueOnce(new Error('invalid_token'));

        const err = await service
          .googleAuth({ idToken: 'forged-or-invalid-token' }, mockRes)
          .catch((e) => e);

        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.message).toBe('Invalid Google ID token');
        expect(jwtService.decode).not.toHaveBeenCalled();
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
      });

      it('rejects with a distinct message when the token verifies successfully but carries no payload at all', async () => {
        mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => null });

        const err = await service
          .googleAuth({ idToken: 'valid-signature-empty-payload' }, mockRes)
          .catch((e) => e);

        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.message).toBe('Invalid Google token payload');
        expect(jwtService.decode).not.toHaveBeenCalled();
      });

      it('rejects with a distinct message when the token verifies successfully but the payload has no email claim', async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
          getPayload: () => ({ sub: 'google-sub-no-email' }),
        });

        const err = await service
          .googleAuth({ idToken: 'valid-signature-no-email' }, mockRes)
          .catch((e) => e);

        expect(err).toBeInstanceOf(UnauthorizedException);
        expect(err.message).toBe('Invalid Google token payload');
        expect(jwtService.decode).not.toHaveBeenCalled();
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      });

      it('verifies the token against the configured GOOGLE_CLIENT_ID as the audience', async () => {
        mockVerifyIdToken.mockResolvedValueOnce({
          getPayload: () => ({ email: 'someone@x.com', sub: 'google-sub-9' }),
        });
        mockPrisma.user.findUnique.mockResolvedValueOnce(
          makeUser({
            email: 'someone@x.com',
            authAccounts: [googleAccount({ providerUserId: 'google-sub-9' })],
          }),
        );

        await service.googleAuth({ idToken: 'some-token' }, mockRes);

        expect(mockVerifyIdToken).toHaveBeenCalledWith(
          expect.objectContaining({
            idToken: 'some-token',
            audience: 'test-google-client-id',
          }),
        );
      });
    });
  });

  // ========================================================================
  // REFRESH
  // ========================================================================
  describe('refresh', () => {
    const reqWithCookie = (token: string) =>
      ({ cookies: { refresh_token: token } } as any);
    const reqNoCookie = { cookies: {} } as any;

    it('rejects when no refresh_token cookie is present, without attempting to verify anything', async () => {
      const err = await service.refresh(reqNoCookie, mockRes).catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('No refresh token provided');
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('rejects when the refresh token is invalid or expired', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

      const err = await service
        .refresh(reqWithCookie('bad-token'), mockRes)
        .catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('Invalid or expired refresh token');
    });

    it('rejects an otherwise-valid ACCESS token presented as a refresh token (prevents token-type confusion)', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'emailA@gmail.com',
        role: RoleEnum.USER,
        type: 'access',
      });

      const err = await service
        .refresh(reqWithCookie('an-access-token'), mockRes)
        .catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('Invalid token type');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'emailA@gmail.com',
        role: RoleEnum.USER,
        type: 'refresh',
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const err = await service
        .refresh(reqWithCookie('valid-refresh'), mockRes)
        .catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('User not found');
    });

    it('rejects when the user has been soft-deleted', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'emailA@gmail.com',
        role: RoleEnum.USER,
        type: 'refresh',
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ deletedAt: new Date() }),
      );

      const err = await service
        .refresh(reqWithCookie('valid-refresh'), mockRes)
        .catch((e) => e);

      expect(err.message).toBe('User not found');
    });

    it('on success: issues a new access + refresh token (rotation), sets a new refresh cookie, and returns the new access token', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'emailA@gmail.com',
        role: RoleEnum.USER,
        type: 'refresh',
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce(makeUser());

      const result = await service.refresh(reqWithCookie('old-refresh'), mockRes);

      expect(result.message).toBe('Token refreshed successfully');
      expect(result.accessToken).toEqual(expect.any(String));
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('re-derives the role/email from the current DB record rather than trusting the (possibly stale) token payload', async () => {
      // Token was issued while the user was a plain USER...
      jwtService.verifyAsync.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'emailA@gmail.com',
        role: 'USER',
        type: 'refresh',
      });
      // ...but the DB now says they were promoted to ADMIN. The new token
      // must reflect the current DB state, not the stale claim.
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ role: RoleEnum.ADMIN }),
      );

      await service.refresh(reqWithCookie('old-refresh'), mockRes);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ role: RoleEnum.ADMIN }),
        expect.anything(),
      );
    });
  });

  // ========================================================================
  // GET ME
  // ========================================================================
  describe('getMe', () => {
    it('rejects when no user exists with the given id', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      const err = await service.getMe('unknown-id').catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('User not found');
    });

    it('rejects when the user has been soft-deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ deletedAt: new Date() }),
      );

      const err = await service.getMe('user-uuid-1').catch((e) => e);

      expect(err.message).toBe('User not found');
    });

    it('returns the sanitized user profile on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(makeUser());

      const result = await service.getMe('user-uuid-1');

      expect(result).toEqual({
        id: 'user-uuid-1',
        email: 'emailA@gmail.com',
        username: 'emailA',
        role: RoleEnum.USER,
        profileImage: null,
        createdAt: expect.any(Date),
      });
    });
  });

  // ========================================================================
  // LOGOUT
  // ========================================================================
  describe('logout', () => {
    it('clears the refresh_token cookie (same path it was set with) and returns a success message', async () => {
      const result = await service.logout(mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/' }),
      );
      expect(result).toEqual({ message: 'Logout successful' });
    });
  });

  // ========================================================================
  // TOKEN GENERATION
  // ========================================================================
  describe('generateTokens', () => {
    it('signs an access token (1 day) and a refresh token (7 days), each tagged with its own type', async () => {
      const tokens = await service.generateTokens('uid-1', 'em@x.com', 'USER');

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uid-1',
          email: 'em@x.com',
          role: 'USER',
          type: 'access',
        }),
        expect.objectContaining({ expiresIn: '1d' }),
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'uid-1',
          email: 'em@x.com',
          role: 'USER',
          type: 'refresh',
        }),
        expect.objectContaining({ expiresIn: '7d' }),
      );
      expect(tokens.accessToken).toBe('signed.access.token');
      expect(tokens.refreshToken).toBe('signed.refresh.token');
    });
  });

  // ========================================================================
  // REFRESH COOKIE SETTINGS
  // ========================================================================
  describe('refresh token cookie settings', () => {
    const registerASuccessfulUser = () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hash');
      mockPrisma.user.create.mockResolvedValueOnce(makeUser());
      return service.register(
        { email: 'a@b.com', password: 'password123', username: 'a' },
        mockRes,
      );
    };

    it('is httpOnly, sameSite=lax, path=/, and expires in 7 days', async () => {
      await registerASuccessfulUser();

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 1000 * 60 * 60 * 24 * 7,
        }),
      );
    });

    it('is NOT marked secure outside production', async () => {
      await registerASuccessfulUser();

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ secure: false }),
      );
    });

    it('IS marked secure in production', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'NODE_ENV' ? 'production' : defaultConfig[key],
      );

      await registerASuccessfulUser();

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
    });
  });
});
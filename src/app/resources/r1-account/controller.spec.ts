// ============================================================================
// AUTH CONTROLLER SPEC
// File: src/app/resources/r1-account/controller.spec.ts
// ============================================================================
//
// These are unit tests for AuthController only. AuthService is fully mocked,
// so these tests do NOT verify auth business logic (password hashing, token
// signing, provider-collision detection, etc.) — they verify that the
// controller:
//   1. Delegates each route to the correct service method with the correct
//      arguments (dto, res, req, decorated user).
//   2. Returns whatever the service returns, unmodified.
//   3. Propagates service errors unmodified (doesn't catch/rewrite them).
//
// The account-collision scenarios (register/login/googleAuth) are simulated
// by having the mocked service reject with the specific exceptions the
// service is expected to throw.

// IMPORTANT: this must run before AuthController/AuthService are imported.
jest.mock('../../../../prisma/client', () => ({
    prismaClient: {},
}));

import {
    ConflictException,
    UnauthorizedException
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { type Request, type Response } from 'express';
import { type TokenPayload } from '../../constants/jwt';
import { AuthController } from './controller';
import { AuthResponse, GoogleAuthDto, LoginDto, RegisterDto } from './dto';
import { AuthService } from './service';

describe('AuthController', () => {
    let controller: AuthController;
    let service: jest.Mocked<AuthService>;

    // --------------------------------------------------------------------
    // Mock data, shaped per the prisma schema (User / AuthAccount)
    // --------------------------------------------------------------------
    const mockUserResponse = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'emailA@gmail.com',
        username: 'emailA',
        role: 'USER',
        profileImage: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const mockAuthResponse: AuthResponse = {
        message: 'ok',
        user: mockUserResponse,
        accessToken: 'mock.access.token',
    };

    // A minimal fake Response — controllers use @Res({ passthrough: true }),
    // so we just need something that can be forwarded to the service and
    // whose identity we can assert on.
    const mockRes = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
    } as unknown as Response;

    const mockReqWithCookie = {
        cookies: { refresh_token: 'valid.refresh.token' },
    } as unknown as Request;

    const mockReqNoCookie = {
        cookies: {},
    } as unknown as Request;

    const mockTokenPayload: TokenPayload = {
        id: mockUserResponse.id,
        email: mockUserResponse.email,
        role: mockUserResponse.role,
    } as TokenPayload;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        register: jest.fn(),
                        login: jest.fn(),
                        googleAuth: jest.fn(),
                        refresh: jest.fn(),
                        logout: jest.fn(),
                        getMe: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<AuthController>(AuthController);
        service = module.get(AuthService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ========================================================================
    // REGISTER
    // ========================================================================
    describe('register', () => {
        const dto: RegisterDto = {
            email: 'emailA@gmail.com',
            password: 'password123',
            username: 'newuser',
        };

        it('delegates to authService.register with the dto and res, and returns its result', async () => {
            service.register.mockResolvedValueOnce(mockAuthResponse);

            const result = await controller.register(dto, mockRes);

            expect(service.register).toHaveBeenCalledTimes(1);
            expect(service.register).toHaveBeenCalledWith(dto, mockRes);
            expect(result).toBe(mockAuthResponse);
        });

        it('propagates a ConflictException when the email already exists as a Google-only account', async () => {
            const err = new ConflictException(
                'This email is already registered via Google. Please sign in with Google instead.',
            );
            service.register.mockRejectedValueOnce(err);

            // Single call, single rejection — capture it once and assert both
            // the type and the message against that same rejection, rather than
            // calling the controller twice against a mock only queued once.
            const thrown = await controller.register(dto, mockRes).catch((e) => e);

            expect(thrown).toBeInstanceOf(ConflictException);
            expect((thrown as Error).message).toBe(
                'This email is already registered via Google. Please sign in with Google instead.',
            );
        });

        it('propagates the generic ConflictException for a same-provider duplicate email', async () => {
            const err = new ConflictException(
                'An account with this email already exists.',
            );
            service.register.mockRejectedValueOnce(err);

            await expect(controller.register(dto, mockRes)).rejects.toThrow(
                'An account with this email already exists.',
            );
        });
    });

    // ========================================================================
    // LOGIN
    // ========================================================================
    describe('login', () => {
        const dto: LoginDto = {
            email: 'emailA@gmail.com',
            password: 'password123',
        };

        it('delegates to authService.login with the dto and res, and returns its result', async () => {
            service.login.mockResolvedValueOnce(mockAuthResponse);

            const result = await controller.login(dto, mockRes);

            expect(service.login).toHaveBeenCalledTimes(1);
            expect(service.login).toHaveBeenCalledWith(dto, mockRes);
            expect(result).toBe(mockAuthResponse);
        });

        it('propagates an UnauthorizedException directing the user to Google sign-in when only a Google account exists', async () => {
            const err = new UnauthorizedException(
                'This email is registered with Google. Please sign in with Google instead.',
            );
            service.login.mockRejectedValueOnce(err);

            const thrown = await controller.login(dto, mockRes).catch((e) => e);

            expect(thrown).toBeInstanceOf(UnauthorizedException);
            expect((thrown as Error).message).toBe(
                'This email is registered with Google. Please sign in with Google instead.',
            );
        });

        it('propagates the generic invalid-credentials UnauthorizedException for wrong password', async () => {
            const err = new UnauthorizedException('Invalid email or password');
            service.login.mockRejectedValueOnce(err);

            await expect(controller.login(dto, mockRes)).rejects.toThrow(
                'Invalid email or password',
            );
        });
    });

    // ========================================================================
    // GOOGLE AUTH
    // ========================================================================
    describe('googleAuth', () => {
        const dto: GoogleAuthDto = { idToken: 'fake.google.id.token' };

        it('delegates to authService.googleAuth with the dto and res, and returns its result', async () => {
            service.googleAuth.mockResolvedValueOnce(mockAuthResponse);

            const result = await controller.googleAuth(dto, mockRes);

            expect(service.googleAuth).toHaveBeenCalledTimes(1);
            expect(service.googleAuth).toHaveBeenCalledWith(dto, mockRes);
            expect(result).toBe(mockAuthResponse);
        });

        it('propagates an UnauthorizedException directing the user to password login when only a local account exists (no silent linking)', async () => {
            const err = new UnauthorizedException(
                'This email is already registered. Please sign in with your email and password instead.',
            );
            service.googleAuth.mockRejectedValueOnce(err);

            const thrown = await controller.googleAuth(dto, mockRes).catch((e) => e);

            expect(thrown).toBeInstanceOf(UnauthorizedException);
            expect((thrown as Error).message).toBe(
                'This email is already registered. Please sign in with your email and password instead.',
            );
        });

        it('succeeds for a brand-new email (new user created)', async () => {
            service.googleAuth.mockResolvedValueOnce({
                ...mockAuthResponse,
                message: 'Google authentication successful',
            });

            const result = await controller.googleAuth(dto, mockRes);

            expect(result.message).toBe('Google authentication successful');
        });

        it('succeeds for an existing Google-linked account (no collision)', async () => {
            service.googleAuth.mockResolvedValueOnce(mockAuthResponse);

            const result = await controller.googleAuth(dto, mockRes);

            expect(result).toBe(mockAuthResponse);
            expect(service.googleAuth).toHaveBeenCalledWith(dto, mockRes);
        });
    });

    // ========================================================================
    // REFRESH
    // ========================================================================
    describe('refresh', () => {
        it('delegates to authService.refresh with req and res, and returns its result', async () => {
            const refreshResult = { message: 'Token refreshed successfully', accessToken: 'new.access.token' };
            service.refresh.mockResolvedValueOnce(refreshResult);

            const result = await controller.refresh(mockReqWithCookie, mockRes);

            expect(service.refresh).toHaveBeenCalledTimes(1);
            expect(service.refresh).toHaveBeenCalledWith(mockReqWithCookie, mockRes);
            expect(result).toBe(refreshResult);
        });

        it('propagates an UnauthorizedException when no refresh token cookie is present', async () => {
            const err = new UnauthorizedException('No refresh token provided');
            service.refresh.mockRejectedValueOnce(err);

            await expect(
                controller.refresh(mockReqNoCookie, mockRes),
            ).rejects.toThrow('No refresh token provided');
            expect(service.refresh).toHaveBeenCalledWith(mockReqNoCookie, mockRes);
        });

        it('propagates an UnauthorizedException when the refresh token is invalid or expired', async () => {
            const err = new UnauthorizedException('Invalid or expired refresh token');
            service.refresh.mockRejectedValueOnce(err);

            await expect(
                controller.refresh(mockReqWithCookie, mockRes),
            ).rejects.toThrow('Invalid or expired refresh token');
        });
    });

    // ========================================================================
    // LOGOUT
    // ========================================================================
    describe('logout', () => {
        it('delegates to authService.logout with res, and returns its result', async () => {
            const logoutResult = { message: 'Logout successful' };
            service.logout.mockResolvedValueOnce(logoutResult);

            const result = await controller.logout(mockRes);

            expect(service.logout).toHaveBeenCalledTimes(1);
            expect(service.logout).toHaveBeenCalledWith(mockRes);
            expect(result).toBe(logoutResult);
        });
    });

    // ========================================================================
    // CURRENT USER INFO (/me)
    // ========================================================================
    describe('me', () => {
        it('delegates to authService.getMe with the decorated user id, and returns its result', async () => {
            service.getMe.mockResolvedValueOnce(mockUserResponse);

            const result = await controller.me(mockTokenPayload);

            expect(service.getMe).toHaveBeenCalledTimes(1);
            expect(service.getMe).toHaveBeenCalledWith(mockTokenPayload.id);
            expect(result).toBe(mockUserResponse);
        });

        it('propagates an UnauthorizedException when the user no longer exists (e.g. soft-deleted)', async () => {
            const err = new UnauthorizedException('User not found');
            service.getMe.mockRejectedValueOnce(err);

            await expect(controller.me(mockTokenPayload)).rejects.toThrow(
                'User not found',
            );
        });
    });

    // ========================================================================
    // CROSS-CUTTING: distinct account-collision scenarios in one place
    // ========================================================================
    // These mirror the three explicit rules from the spec, exercised together
    // so a regression in any one of them is easy to spot as a group.
    describe('one-email-one-provider collision rules', () => {
        const sharedEmail = 'emailA@gmail.com';

        it('register while a Google account exists for the email -> blocked, told to use Google', async () => {
            service.register.mockRejectedValueOnce(
                new ConflictException(
                    'This email is already registered via Google. Please sign in with Google instead.',
                ),
            );

            await expect(
                controller.register(
                    { email: sharedEmail, password: 'password123', username: 'x' },
                    mockRes,
                ),
            ).rejects.toThrow(/sign in with Google instead/i);
        });

        it('local login while only a Google account exists for the email -> blocked, told to use Google', async () => {
            service.login.mockRejectedValueOnce(
                new UnauthorizedException(
                    'This email is registered with Google. Please sign in with Google instead.',
                ),
            );

            await expect(
                controller.login({ email: sharedEmail, password: 'password123' }, mockRes),
            ).rejects.toThrow(/sign in with Google instead/i);
        });

        it('google auth while only a local account exists for the email -> blocked, told to use password (no auto-link)', async () => {
            service.googleAuth.mockRejectedValueOnce(
                new UnauthorizedException(
                    'This email is already registered. Please sign in with your email and password instead.',
                ),
            );

            await expect(
                controller.googleAuth({ idToken: 'token' }, mockRes),
            ).rejects.toThrow(/sign in with your email and password instead/i);
        });
    });
});
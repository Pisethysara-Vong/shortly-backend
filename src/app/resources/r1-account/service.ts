// ============================================================================
// AUTH SERVICE
// File: src/app/resources/r1-account/service.ts
// ============================================================================

import {
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';
import { prismaClient } from '../../../../prisma/client';
import { RoleEnum } from '../../../../enums/role.enum';
import { AuthEnum } from '../../../../enums/auth.enum';
import {
    AuthResponse,
    AuthTokens,
    GoogleAuthDto,
    JwtPayload,
    LoginDto,
    RegisterDto,
    UserResponse,
} from './dto';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days, matches refresh JWT expiry

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) {
        this.googleClient = new OAuth2Client(this.config.get('GOOGLE_CLIENT_ID'));
    }

    // ========================================================================
    // REGISTER
    // ========================================================================
    async register(dto: RegisterDto, res: Response): Promise<AuthResponse> {
        const existingUser = await prismaClient.user.findUnique({
            where: { email: dto.email },
            include: { authAccounts: true },
        });

        if (existingUser) {
            const hasGoogle = existingUser.authAccounts.some(
                (a) => a.provider === AuthEnum.GOOGLE,
            );
            const hasLocal = existingUser.authAccounts.some(
                (a) => a.provider === AuthEnum.LOCAL,
            );

            if (hasGoogle && !hasLocal) {
                throw new ConflictException(
                    'This email is already registered via Google. Please sign in with Google instead.',
                );
            }

            throw new ConflictException(
                'An account with this email already exists.',
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await prismaClient.user.create({
            data: {
                email: dto.email,
                username: dto.username,
                role: RoleEnum.USER,
                authAccounts: {
                    create: {
                        provider: AuthEnum.LOCAL,
                        passwordHash,
                    },
                },
            },
            include: { authAccounts: true },
        });

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        this.setRefreshTokenCookie(res, tokens.refreshToken);

        return {
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                profileImage: user.profileImage,
                createdAt: user.createdAt,
            },
            accessToken: tokens.accessToken,
        };
    }

    // ========================================================================
    // LOGIN
    // ========================================================================
    async login(dto: LoginDto, res: Response): Promise<AuthResponse> {
        const user = await prismaClient.user.findUnique({
            where: { email: dto.email },
            include: { authAccounts: true },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const localAccount = user.authAccounts.find(
            (a) => a.provider === AuthEnum.LOCAL,
        );

        if (!localAccount) {
            const hasGoogle = user.authAccounts.some(
                (a) => a.provider === AuthEnum.GOOGLE,
            );

            if (hasGoogle) {
                throw new UnauthorizedException(
                    'This email is registered with Google. Please sign in with Google instead.',
                );
            }

            throw new UnauthorizedException('Invalid email or password');
        }

        if (localAccount.disabledAt || !localAccount.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const isPasswordValid = await bcrypt.compare(
            dto.password,
            localAccount.passwordHash,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        this.setRefreshTokenCookie(res, tokens.refreshToken);

        return {
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                profileImage: user.profileImage,
                createdAt: user.createdAt,
            },
            accessToken: tokens.accessToken,
        };
    }

    // ========================================================================
    // GOOGLE AUTH
    // ========================================================================
    async googleAuth(dto: GoogleAuthDto, res: Response): Promise<AuthResponse> {
        let email: string;
        let googleId: string;
        let name: string | undefined;
        let picture: string | undefined;

        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: dto.idToken,
                audience: this.config.get('GOOGLE_CLIENT_ID'),
            });
            const payload = ticket.getPayload();

            if (!payload || !payload.email) {
                throw new UnauthorizedException('Invalid Google token payload');
            }

            email = payload.email;
            googleId = payload.sub;
            name = payload.name;
            picture = payload.picture;
        } catch (err) {
            // No fallback decoding. Any failure here — a bad signature, wrong
            // audience, expired token, malformed token, or missing email — is
            // rejected outright. We never trust claims from a token that failed
            // verification.
            if (err instanceof UnauthorizedException) {
                throw err;
            }
            throw new UnauthorizedException('Invalid Google ID token');
        }

        let user = await prismaClient.user.findUnique({
            where: { email },
            include: { authAccounts: true },
        });

        if (user) {
            if (user.deletedAt) {
                throw new UnauthorizedException('This account has been deleted');
            }

            const googleAccount = user.authAccounts.find(
                (a) => a.provider === AuthEnum.GOOGLE,
            );

            if (!googleAccount) {
                // Email collides with an existing account that isn't linked to Google.
                // Reject rather than silently linking — the person didn't prove
                // ownership of the local account's password.
                throw new UnauthorizedException(
                    'This email is already registered. Please sign in with your email and password instead.',
                );
            }
        } else {
            user = await prismaClient.user.create({
                data: {
                    email,
                    username: name || email.split('@')[0],
                    profileImage: picture || null,
                    role: RoleEnum.USER,
                    authAccounts: {
                        create: {
                            provider: AuthEnum.GOOGLE,
                            providerUserId: googleId,
                        },
                    },
                },
                include: { authAccounts: true },
            });
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        this.setRefreshTokenCookie(res, tokens.refreshToken);

        return {
            message: 'Google authentication successful',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                profileImage: user.profileImage,
                createdAt: user.createdAt,
            },
            accessToken: tokens.accessToken,
        };
    }

    // ========================================================================
    // REFRESH
    // ========================================================================
    async refresh(
        req: Request,
        res: Response,
    ): Promise<{ message: string; accessToken: string }> {
        const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

        if (!refreshToken) {
            throw new UnauthorizedException('No refresh token provided');
        }

        let payload: JwtPayload;
        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
                secret: this.getSecret(),
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        if (payload.type !== 'refresh') {
            throw new UnauthorizedException('Invalid token type');
        }

        const user = await prismaClient.user.findUnique({
            where: { id: payload.id },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedException('User not found');
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);
        this.setRefreshTokenCookie(res, tokens.refreshToken);

        return {
            message: 'Token refreshed successfully',
            accessToken: tokens.accessToken,
        };
    }

    // ========================================================================
    // GET ME
    // ========================================================================
    async getMe(userId: string): Promise<UserResponse> {
        const user = await prismaClient.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.deletedAt) {
            throw new UnauthorizedException('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            profileImage: user.profileImage,
            createdAt: user.createdAt,
        };
    }

    // ========================================================================
    // LOGOUT
    // ========================================================================
    async logout(res: Response): Promise<{ message: string }> {
        res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
        return { message: 'Logout successful' };
    }

    // ========================================================================
    // TOKEN GENERATION
    // ========================================================================
    async generateTokens(
        userId: string,
        email: string,
        role: string,
    ): Promise<AuthTokens> {
        const secret = this.getSecret();

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                { id: userId, email, role, type: 'access' } as JwtPayload,
                { secret, expiresIn: '1d' },
            ),
            this.jwtService.signAsync(
                { id: userId, email, role, type: 'refresh' } as JwtPayload,
                { secret, expiresIn: '7d' },
            ),
        ]);

        return { accessToken, refreshToken };
    }

    // ========================================================================
    // HELPERS
    // ========================================================================
    private getSecret(): string {
        return this.config.get('JWT_SECRET') || process.env.JWT_SECRET || 'secret';
    }

    private setRefreshTokenCookie(res: Response, refreshToken: string): void {
        res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
            httpOnly: true,
            secure: this.config.get('NODE_ENV') === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: REFRESH_TOKEN_MAX_AGE,
        });
    }
}
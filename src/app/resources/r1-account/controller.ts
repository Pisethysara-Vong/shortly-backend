// ============================================================================
// AUTH CONTROLLER
// File: src/app/resources/r1-account/controller.ts
// ============================================================================

import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { GoogleAuthDto, LoginDto, RegisterDto } from './dto';
import { AuthService } from './service';
import UserDecorator from '../../decorators/user.decorator';
import { type TokenPayload } from '../../constants/jwt';

@Controller()
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    // ========================================================================
    // REGISTER
    // ========================================================================
    @Post('register')
    async register(
        @Body() dto: RegisterDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.register(dto, res);
    }

    // ========================================================================
    // LOGIN
    // ========================================================================
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(
        @Body() dto: LoginDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.login(dto, res);
    }

    // ========================================================================
    // GOOGLE AUTH
    // ========================================================================
    @Post('google')
    @HttpCode(HttpStatus.OK)
    async googleAuth(
        @Body() dto: GoogleAuthDto,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.googleAuth(dto, res);
    }

    // ========================================================================
    // REFRESH
    // ========================================================================
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.refresh(req, res);
    }

    // ========================================================================
    // LOGOUT
    // ========================================================================
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Res({ passthrough: true }) res: Response) {
        return this.authService.logout(res);
    }

    // ========================================================================
    // CURRENT USER INFO
    // ========================================================================
    @Get('me')
    async me(@UserDecorator() user: TokenPayload) {
        return this.authService.getMe(user.id);
    }
}
// ============================================================================
// URL CONTROLLER
// File: src/app/resources/r2-url/controller.ts
// ============================================================================

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { UrlService } from './service';
import { CreateUrlDto } from './dto';
import UserDecorator from '../../decorators/user.decorator';
import { type TokenPayload } from '../../constants/jwt';
import { RoleEnum } from '../../../../enums/role.enum';

@Controller()
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  // ========================================================================
  // CREATE URL
  // ========================================================================
  @Post()
  async createUrl(
    @UserDecorator() user: TokenPayload,
    @Body() dto: CreateUrlDto,
  ) {
    return this.urlService.createUrl(user.id, dto);
  }

  // ========================================================================
  // GET AUTHENTICATED USER'S URLs
  // ========================================================================
  @Get()
  async getUserUrls(@UserDecorator() user: TokenPayload) {
    return this.urlService.getUserUrls(user.id);
  }

  // ========================================================================
  // ADMIN: GET ALL URLs
  // ========================================================================
  @Get('admin/all')
  async getAllUrlsAdmin(@UserDecorator() user: TokenPayload) {
    if (user.role !== RoleEnum.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return this.urlService.getAllUrlsAdmin();
  }

  // ========================================================================
  // ADMIN: GET URLs FOR SPECIFIC USER
  // ========================================================================
  @Get('admin/user/:userId')
  async getUserUrlsAdmin(
    @UserDecorator() user: TokenPayload,
    @Param('userId') targetUserId: string,
  ) {
    if (user.role !== RoleEnum.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return this.urlService.getUserUrlsAdmin(targetUserId);
  }

  // ========================================================================
  // GET URL DETAILS BY ID
  // ========================================================================
  @Get(':id')
  async getUrlById(
    @UserDecorator() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.urlService.getUrlById(user.id, user.role, id);
  }

  // ========================================================================
  // DELETE / UNLINK URL
  // ========================================================================
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUrl(
    @UserDecorator() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.urlService.deleteUrl(user.id, id);
  }
}

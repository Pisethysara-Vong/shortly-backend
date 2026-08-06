// ============================================================================
// REDIRECT CONTROLLER
// File: src/app/resources/r3-redirect/controller.ts
// ============================================================================

import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { type Response } from 'express';
import { RedirectService } from './service';

@Controller()
export class RedirectController {
  constructor(private readonly redirectService: RedirectService) {}

  @Get(':shortCode')
  async redirect(
    @Param('shortCode') shortCode: string,
    @Res() res: Response,
  ) {
    const originalUrl = await this.redirectService.resolveAndIncrement(shortCode);
    return res.redirect(HttpStatus.FOUND, originalUrl);
  }
}

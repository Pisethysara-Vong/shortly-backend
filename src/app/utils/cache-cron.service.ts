import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedirectService } from '../resources/r3-redirect/service';

@Injectable()
export class CacheCronService {
  private readonly logger = new Logger(CacheCronService.name);

  constructor(private readonly redirectService: RedirectService) {}

  // Runs every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  autoResetRedirectCache() {
    this.redirectService.resetCache();
    this.logger.log('Redirect cache reset successfully at midnight.');
  }
}

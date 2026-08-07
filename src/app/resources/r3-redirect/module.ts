// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { RedirectController } from './controller';
import { RedirectService } from './service';
import { CacheCronService } from '../../utils/cache-cron.service';

@Module({
  controllers: [RedirectController],
  providers: [RedirectService, CacheCronService],
  exports: [RedirectService],
})
export class RedirectModule {}

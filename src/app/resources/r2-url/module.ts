// ===========================================================================>> Core Library
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';

// ===========================================================================>> Custom Library
import { UserMiddleware } from '../../middlewares/user.middleware';
import { UrlController } from './controller';
import { UrlService } from './service';

@Module({
  controllers: [UrlController],
  providers: [UrlService],
  exports: [UrlService],
})
export class UrlModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(UserMiddleware)
      .exclude({ path: 'api/url/admin/(.*)', method: RequestMethod.ALL })
      .forRoutes({ path: 'api/url/*', method: RequestMethod.ALL });
  }
}

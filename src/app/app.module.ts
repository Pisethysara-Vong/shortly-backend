import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AccountModule } from './resources/r1-account/module';
import { UrlModule } from './resources/r2-url/module';
import { RedirectModule } from './resources/r3-redirect/module';
import { JwtMiddleware } from './middlewares/jwt.middleware';
import { CacheCronService } from './utils/cache-cron.service';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    AccountModule,
    UrlModule,
    RedirectModule,
  ],
  providers: [
    CacheCronService
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware)
      .exclude(
        { path: '', method: RequestMethod.GET },
        { path: 'api/account/(.*)', method: RequestMethod.GET },
        { path: 'api/redirect/(.*)', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

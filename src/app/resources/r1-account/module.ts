// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

// ===========================================================================>> Custom Library
import { AuthController } from './controller';
import { AuthService } from './service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AccountModule {}

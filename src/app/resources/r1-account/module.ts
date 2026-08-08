// ===========================================================================>> Core Library
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// ===========================================================================>> Custom Library
import { AuthController } from './controller';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, JwtService],
  exports: [AuthService],
})
export class AccountModule {}

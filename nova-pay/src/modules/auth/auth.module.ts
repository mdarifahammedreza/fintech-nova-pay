import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { LoginHandler } from './command/handlers/login.handler';
import { RegisterHandler } from './command/handlers/register.handler';
import { AuthController } from './controller/auth.controller';
import { RefreshToken } from './entities/refresh-token.entity';
import { ValidateSessionHandler } from './query/handlers/validate-session.handler';
import { AuthSessionRepository } from './repositories/auth-session.repository';
import { AuthService } from './service/auth.service';
import { TokenService } from './service/token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthSessionRepository,
    LoginHandler,
    RegisterHandler,
    ValidateSessionHandler,
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}

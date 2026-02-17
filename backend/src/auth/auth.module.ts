import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DIDSignatureService } from './services/did-signature.service';
import { DIDAuthGuard } from './guards/did-auth.guard';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
    BlockchainModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, DIDSignatureService, DIDAuthGuard],
  exports: [AuthService, DIDSignatureService, DIDAuthGuard],
})
export class AuthModule {}

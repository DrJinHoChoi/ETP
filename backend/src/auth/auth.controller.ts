import { Controller, Post, Get, Body, Param, UseGuards, Req, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: '회원가입 (DID 자동 발급)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: '이메일/비밀번호 로그인' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 프로필 조회 (DID 포함)' })
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  // ========== DID 관리 ==========

  @Post('did/issue')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DID 발급 (미발급 시)' })
  issueDID(@Req() req: any) {
    return this.authService.issueDID(req.user.id);
  }

  @Get('did/verify/:did')
  @ApiOperation({ summary: 'DID 검증' })
  verifyDID(@Param('did') did: string) {
    return this.authService.verifyDID(did);
  }

  @Delete('did/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DID 폐기' })
  revokeDID(@Req() req: any) {
    return this.authService.revokeDID(req.user.id);
  }

  // ========== DID 챌린지-응답 인증 ==========

  @Post('did/challenge')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'DID 로그인 챌린지 요청 (1단계)' })
  createDIDChallenge(@Body('did') did: string) {
    return this.authService.createDIDChallenge(did);
  }

  @Post('did/login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'DID 로그인 서명 제출 (2단계)' })
  loginWithDID(
    @Body('did') did: string,
    @Body('signature') signature: string,
  ) {
    return this.authService.loginWithDID(did, signature);
  }
}

import { Controller, Post, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '회원가입 (DID 자동 발급)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '로그인' })
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
}

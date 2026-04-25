import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TokenService } from './token.service';
import { TransferTokenDto, AdminMintDto } from './dto/transfer-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('EPC 토큰')
@Controller('token')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('balance')
  @ApiOperation({ summary: 'EPC 잔액 조회' })
  async getBalance(@Request() req: any) {
    return this.tokenService.getBalance(req.user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: '토큰 거래 이력 조회' })
  async getTransactions(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tokenService.getTransactions(req.user.id, {
      type: type as any,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('transfer')
  @ApiOperation({ summary: 'EPC 이체' })
  async transfer(@Request() req: any, @Body() dto: TransferTokenDto) {
    return this.tokenService.transfer(
      req.user.id,
      dto.toUserId,
      dto.amount,
      dto.reason || 'transfer',
    );
  }

  @Post('admin/mint')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: '관리자 EPC 발행' })
  async adminMint(@Body() dto: AdminMintDto) {
    return this.tokenService.adminMint(dto.userId, dto.amount, dto.reason);
  }
}

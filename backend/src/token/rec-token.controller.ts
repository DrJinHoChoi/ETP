import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RECTokenService } from './rec-token.service';
import { TransferRECDto } from './dto/transfer-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnergySource } from '@prisma/client';

@ApiTags('REC 토큰')
@Controller('rec-token')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RECTokenController {
  constructor(private readonly recTokenService: RECTokenService) {}

  @Get()
  @ApiOperation({ summary: '내 REC 토큰 조회' })
  async getMyTokens(@Request() req: any, @Query('status') status?: string) {
    return this.recTokenService.getTokensByOwner(
      req.user.id,
      status as any,
    );
  }

  @Get('marketplace')
  @ApiOperation({ summary: 'REC 마켓플레이스' })
  async getMarketplace(
    @Query('energySource') energySource?: EnergySource,
    @Query('minQty') minQty?: string,
  ) {
    return this.recTokenService.getMarketplace({
      energySource,
      minQty: minQty ? parseFloat(minQty) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'REC 토큰 상세 조회' })
  async getToken(@Param('id') id: string) {
    return this.recTokenService.getToken(id);
  }

  @Post(':id/transfer')
  @ApiOperation({ summary: 'REC 토큰 양도' })
  async transfer(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: TransferRECDto,
  ) {
    return this.recTokenService.transfer(id, req.user.id, dto.toUserId);
  }

  @Post(':id/retire')
  @ApiOperation({ summary: 'REC 토큰 소멸 (RE100)' })
  async retire(@Param('id') id: string, @Request() req: any) {
    return this.recTokenService.retire(id, req.user.id);
  }

  @Post('issue/:certId')
  @ApiOperation({ summary: 'REC 인증서에서 토큰 발행' })
  async issueFromCert(@Param('certId') certId: string) {
    return this.recTokenService.issueFromCertificate(certId);
  }
}

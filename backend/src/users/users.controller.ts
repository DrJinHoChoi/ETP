import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('사용자')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '사용자 목록 조회' })
  @ApiQuery({ name: 'role', enum: UserRole, required: false })
  findAll(@Query('role') role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @Get('admin/all')
  @ApiOperation({ summary: '전체 사용자 + 통계 (Admin)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAllUsersWithStats() {
    return this.usersService.getAllUsersWithStats();
  }

  @Get(':id')
  @ApiOperation({ summary: '사용자 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '사용자 대시보드 통계' })
  getDashboardStats(@Param('id') id: string) {
    return this.usersService.getDashboardStats(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '사용자 정보 수정 (Admin)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: '사용자 비활성화 (Admin)' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }
}

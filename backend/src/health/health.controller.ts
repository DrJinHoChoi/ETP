import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '서비스 상태 확인' })
  async check() {
    const dbHealthy = await this.checkDatabase();
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    return {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      version: '0.1.0',
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'connected' : 'disconnected',
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        },
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

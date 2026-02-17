import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(role?: UserRole) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
        status: true,
        createdAt: true,
        didCredential: true,
      },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }
    return user;
  }

  async getDashboardStats(userId: string) {
    const [orderCount, tradeCount] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.trade.count({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      }),
    ]);
    return { orderCount, tradeCount };
  }

  /** 사용자 정보 수정 (Admin) */
  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.organization && { organization: dto.organization }),
        ...(dto.status && { status: dto.status }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
        status: true,
        createdAt: true,
      },
    });

    this.logger.log(`사용자 정보 수정: ${id} → ${JSON.stringify(dto)}`);
    return updated;
  }

  /** 사용자 비활성화 (Admin) — DID도 REVOKED 처리 */
  async deactivateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { didCredential: true },
    });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const operations: any[] = [
      this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.SUSPENDED },
      }),
    ];

    // DID가 있으면 REVOKED 처리
    if (user.didCredential && user.didCredential.status === 'ACTIVE') {
      operations.push(
        this.prisma.dIDCredential.update({
          where: { userId: id },
          data: { status: 'REVOKED' },
        }),
      );
    }

    await this.prisma.$transaction(operations);
    this.logger.warn(`사용자 비활성화: ${id} (${user.email})`);

    return { id, status: UserStatus.SUSPENDED, didRevoked: !!user.didCredential };
  }

  /** 전체 사용자 목록 + 통계 (Admin) */
  async getAllUsersWithStats() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organization: true,
        status: true,
        createdAt: true,
        didCredential: { select: { did: true, status: true } },
        _count: {
          select: {
            orders: true,
            buyTrades: true,
            sellTrades: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      organization: u.organization,
      status: u.status,
      createdAt: u.createdAt,
      did: u.didCredential?.did || null,
      didStatus: u.didCredential?.status || null,
      orderCount: u._count.orders,
      tradeCount: u._count.buyTrades + u._count.sellTrades,
    }));
  }
}

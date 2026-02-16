import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
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
}

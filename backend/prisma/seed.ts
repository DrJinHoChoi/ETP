import { PrismaClient, UserRole, EnergySource, OrderType, OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. 관리자 계정
  const adminPw = await bcrypt.hash('admin1234', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@etp.com' },
    update: {},
    create: {
      email: 'admin@etp.com',
      password: adminPw,
      name: '시스템관리자',
      role: UserRole.ADMIN,
      organization: 'ETP 운영',
      status: 'ACTIVE',
    },
  });
  console.log(`Admin: ${admin.email} (${admin.id})`);

  // 2. 공급자 계정
  const supplierPw = await bcrypt.hash('supplier1234', 10);
  const suppliers = [];
  const supplierData = [
    { email: 'solar@etp.com', name: '태양광발전(주)', org: '한화솔라원' },
    { email: 'wind@etp.com', name: '풍력에너지(주)', org: '두산풍력' },
    { email: 'hydro@etp.com', name: '수력발전(주)', org: '한국수력원자력' },
  ];

  for (const s of supplierData) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        password: supplierPw,
        name: s.name,
        role: UserRole.SUPPLIER,
        organization: s.org,
        status: 'ACTIVE',
      },
    });
    suppliers.push(user);
    console.log(`Supplier: ${user.email} (${user.id})`);
  }

  // 3. 소비자 계정
  const consumerPw = await bcrypt.hash('consumer1234', 10);
  const consumers = [];
  const consumerData = [
    { email: 'samsung@etp.com', name: '삼성전자', org: '삼성전자' },
    { email: 'sk@etp.com', name: 'SK하이닉스', org: 'SK하이닉스' },
    { email: 'lg@etp.com', name: 'LG화학', org: 'LG화학' },
  ];

  for (const c of consumerData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: {
        email: c.email,
        password: consumerPw,
        name: c.name,
        role: UserRole.CONSUMER,
        organization: c.org,
        status: 'ACTIVE',
      },
    });
    consumers.push(user);
    console.log(`Consumer: ${user.email} (${user.id})`);
  }

  // 4. EPC 토큰 잔액 설정
  for (const user of [...suppliers, ...consumers]) {
    await prisma.tokenBalance.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        balance: user.role === UserRole.SUPPLIER ? 50000 : 100000,
        lockedBalance: 0,
      },
    });
  }
  console.log('Token balances initialized');

  // 5. 샘플 거래 주문
  const sources: EnergySource[] = ['SOLAR', 'WIND', 'HYDRO'];
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  for (let i = 0; i < suppliers.length; i++) {
    await prisma.order.create({
      data: {
        userId: suppliers[i].id,
        type: OrderType.SELL,
        energySource: sources[i],
        quantity: 5000 + i * 1000,
        remainingQty: 5000 + i * 1000,
        price: 110 + i * 5,
        validFrom: now,
        validUntil: nextMonth,
        status: OrderStatus.PENDING,
        paymentCurrency: 'EPC',
      },
    });
  }

  for (let i = 0; i < consumers.length; i++) {
    await prisma.order.create({
      data: {
        userId: consumers[i].id,
        type: OrderType.BUY,
        energySource: sources[i],
        quantity: 3000 + i * 500,
        remainingQty: 3000 + i * 500,
        price: 115 + i * 5,
        validFrom: now,
        validUntil: nextMonth,
        status: OrderStatus.PENDING,
        paymentCurrency: 'EPC',
      },
    });
  }
  console.log('Sample orders created');

  // 6. 샘플 미터링 데이터
  for (let i = 0; i < suppliers.length; i++) {
    for (let day = 0; day < 7; day++) {
      const ts = new Date(now);
      ts.setDate(ts.getDate() - day);
      await prisma.meterReading.create({
        data: {
          userId: suppliers[i].id,
          production: 800 + Math.floor(Math.random() * 400),
          consumption: 50 + Math.floor(Math.random() * 50),
          source: sources[i],
          deviceId: `METER-${String(i + 1).padStart(3, '0')}`,
          timestamp: ts,
        },
      });
    }
  }
  console.log('Sample meter readings created');

  // 7. 샘플 오라클 가격 (24시간)
  for (let hour = 0; hour < 24; hour++) {
    const ts = new Date(now);
    ts.setHours(ts.getHours() - hour);
    await prisma.priceBasket.create({
      data: {
        eiaPrice: 0.075 + Math.random() * 0.01,
        entsoePrice: 0.085 + Math.random() * 0.01,
        kpxPrice: 0.080 + Math.random() * 0.01,
        weightedAvgPrice: 0.080 + Math.random() * 0.005,
        eiaWeight: 0.40,
        entsoeWeight: 0.35,
        kpxWeight: 0.25,
        isStale: false,
        timestamp: ts,
      },
    });
  }
  console.log('Sample price data created');

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

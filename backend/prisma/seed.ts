import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 관리자 계정
  const admin = await prisma.user.upsert({
    where: { email: 'admin@etp.com' },
    update: {},
    create: {
      email: 'admin@etp.com',
      password: await bcrypt.hash('admin1234', 10),
      name: '관리자',
      role: 'ADMIN',
      organization: 'ETP 관리센터',
    },
  });

  // 공급자 계정 (태양광 발전사)
  const supplier1 = await prisma.user.upsert({
    where: { email: 'solar@supplier.com' },
    update: {},
    create: {
      email: 'solar@supplier.com',
      password: await bcrypt.hash('supplier1234', 10),
      name: '김태양',
      role: 'SUPPLIER',
      organization: '한빛솔라에너지',
    },
  });

  // 공급자 계정 (풍력 발전사)
  const supplier2 = await prisma.user.upsert({
    where: { email: 'wind@supplier.com' },
    update: {},
    create: {
      email: 'wind@supplier.com',
      password: await bcrypt.hash('supplier1234', 10),
      name: '이풍력',
      role: 'SUPPLIER',
      organization: '그린윈드파워',
    },
  });

  // 수요자 계정 (RE100 기업)
  const consumer1 = await prisma.user.upsert({
    where: { email: 'factory@consumer.com' },
    update: {},
    create: {
      email: 'factory@consumer.com',
      password: await bcrypt.hash('consumer1234', 10),
      name: '박공장',
      role: 'CONSUMER',
      organization: '대한전자',
    },
  });

  const consumer2 = await prisma.user.upsert({
    where: { email: 'building@consumer.com' },
    update: {},
    create: {
      email: 'building@consumer.com',
      password: await bcrypt.hash('consumer1234', 10),
      name: '최건물',
      role: 'CONSUMER',
      organization: '스마트빌딩',
    },
  });

  // 샘플 주문 생성
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // 매도 주문 (공급자)
  await prisma.order.createMany({
    data: [
      {
        userId: supplier1.id,
        type: 'SELL',
        energySource: 'SOLAR',
        quantity: 5000,
        price: 120,
        remainingQty: 5000,
        validFrom: now,
        validUntil: nextMonth,
      },
      {
        userId: supplier1.id,
        type: 'SELL',
        energySource: 'SOLAR',
        quantity: 3000,
        price: 115,
        remainingQty: 3000,
        validFrom: now,
        validUntil: nextMonth,
      },
      {
        userId: supplier2.id,
        type: 'SELL',
        energySource: 'WIND',
        quantity: 8000,
        price: 110,
        remainingQty: 8000,
        validFrom: now,
        validUntil: nextMonth,
      },
    ],
  });

  // 매수 주문 (수요자)
  await prisma.order.createMany({
    data: [
      {
        userId: consumer1.id,
        type: 'BUY',
        energySource: 'SOLAR',
        quantity: 2000,
        price: 125,
        remainingQty: 2000,
        validFrom: now,
        validUntil: nextMonth,
      },
      {
        userId: consumer2.id,
        type: 'BUY',
        energySource: 'WIND',
        quantity: 4000,
        price: 115,
        remainingQty: 4000,
        validFrom: now,
        validUntil: nextMonth,
      },
    ],
  });

  // 샘플 미터링 데이터
  for (let hour = 0; hour < 24; hour++) {
    const timestamp = new Date(now);
    timestamp.setHours(hour, 0, 0, 0);

    // 태양광 발전 (6시~18시 발전)
    const solarProduction =
      hour >= 6 && hour <= 18
        ? Math.round(Math.sin(((hour - 6) * Math.PI) / 12) * 800 + Math.random() * 100)
        : Math.round(Math.random() * 10);

    await prisma.meterReading.create({
      data: {
        userId: supplier1.id,
        timestamp,
        production: solarProduction,
        consumption: 0,
        source: 'SOLAR',
        deviceId: 'SOLAR-METER-001',
      },
    });

    // 풍력 발전 (24시간 발전)
    await prisma.meterReading.create({
      data: {
        userId: supplier2.id,
        timestamp,
        production: Math.round(300 + Math.random() * 200),
        consumption: 0,
        source: 'WIND',
        deviceId: 'WIND-METER-001',
      },
    });

    // 공장 소비
    await prisma.meterReading.create({
      data: {
        userId: consumer1.id,
        timestamp,
        production: 0,
        consumption: Math.round(400 + Math.sin(((hour - 8) * Math.PI) / 16) * 200 + Math.random() * 50),
        source: 'SOLAR',
        deviceId: 'FACTORY-METER-001',
      },
    });
  }

  console.log('Seed data created:');
  console.log(`  Admin: ${admin.email}`);
  console.log(`  Suppliers: ${supplier1.email}, ${supplier2.email}`);
  console.log(`  Consumers: ${consumer1.email}, ${consumer2.email}`);
  console.log(`  Orders: 5`);
  console.log(`  Meter readings: ${24 * 3}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

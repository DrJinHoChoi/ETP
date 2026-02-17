import { z } from 'zod';

export const createOrderSchema = z.object({
  type: z.enum(['BUY', 'SELL'], { error: '주문 유형을 선택하세요' }),
  energySource: z.enum(['SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'GEOTHERMAL'], {
    error: '에너지원을 선택하세요',
  }),
  quantity: z
    .number({ error: '수량을 입력하세요' })
    .positive('수량은 0보다 커야 합니다')
    .max(100000, '최대 100,000 kWh까지 주문 가능합니다'),
  price: z
    .number({ error: '가격을 입력하세요' })
    .positive('가격은 0보다 커야 합니다'),
  paymentCurrency: z.enum(['KRW', 'EPC'], { error: '결제 통화를 선택하세요' }),
  validFrom: z.string().min(1, '시작 시간을 입력하세요'),
  validUntil: z.string().min(1, '종료 시간을 입력하세요'),
}).refine(
  (data) => {
    if (data.validFrom && data.validUntil) {
      return new Date(data.validUntil) > new Date(data.validFrom);
    }
    return true;
  },
  { message: '종료 시간은 시작 시간 이후여야 합니다', path: ['validUntil'] },
);

export type CreateOrderFormData = z.infer<typeof createOrderSchema>;

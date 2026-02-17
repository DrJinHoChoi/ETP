import { z } from 'zod';

export const transferSchema = z.object({
  toUserId: z.string().uuid('유효한 사용자 UUID를 입력해주세요'),
  amount: z
    .number({ error: '수량을 입력해주세요' })
    .positive('수량은 0보다 커야 합니다')
    .max(1000000, '최대 1,000,000 EPC까지 이체 가능합니다'),
  reason: z.string().optional(),
});

export type TransferFormData = z.infer<typeof transferSchema>;

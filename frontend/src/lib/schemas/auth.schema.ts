import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('유효한 이메일 주소를 입력해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, '이름은 최소 2자 이상이어야 합니다')
    .max(50, '이름은 50자 이하여야 합니다'),
  email: z.email('유효한 이메일 주소를 입력해주세요'),
  password: z
    .string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/[a-z]/, '소문자가 최소 1개 포함되어야 합니다')
    .regex(/[A-Z]/, '대문자가 최소 1개 포함되어야 합니다')
    .regex(/\d/, '숫자가 최소 1개 포함되어야 합니다')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, '특수문자가 최소 1개 포함되어야 합니다'),
  role: z.enum(['SUPPLIER', 'CONSUMER'], { error: '역할을 선택해주세요' }),
  organization: z.string().min(1, '조직명을 입력해주세요'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

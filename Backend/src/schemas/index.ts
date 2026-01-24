import { z } from 'zod';

// 회원가입 스키마
export const registerSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  nickname: z.string().min(2, '닉네임은 최소 2자 이상이어야 합니다').max(20, '닉네임은 최대 20자까지 가능합니다'),
});

// 로그인 스키마
export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

// 항해 시작 스키마
export const startFlightSchema = z.object({
  rocketId: z.number().int().positive('유효한 로켓 ID가 필요합니다'),
  symbol: z.string().min(1, '항로(심볼)를 선택해주세요').default('AAPL'),
});

// 실시간 동기화 스키마
export const syncFlightSchema = z.object({
  fuelInput: z.number().min(0).max(100, '연료 투입량은 0~100 사이여야 합니다'),
  yValue: z.number(), // 현재 중력파 안정도 (주가)
  previousYValue: z.number().optional(), // 이전 중력파 값 (변동률 계산용)
});

// 차트 심볼 스키마
export const chartSymbolSchema = z.object({
  symbol: z.string().min(1, '심볼이 필요합니다').max(10),
});

// 유저 ID 쿼리 스키마
export const userIdQuerySchema = z.object({
  userId: z.string().transform((val) => parseInt(val, 10)),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type StartFlightInput = z.infer<typeof startFlightSchema>;
export type SyncFlightInput = z.infer<typeof syncFlightSchema>;

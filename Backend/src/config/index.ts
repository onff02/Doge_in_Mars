import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  
  // 게임 설정
  game: {
    targetDistance: 1000.0,        // 화성까지의 목표 거리
    initialFuel: 100.0,            // 초기 연료
    initialHull: 100.0,            // 초기 선체 내구도
    maxFuelInput: 100.0,           // 최대 연료 투입량
    
    // 중력파 안정도 임계값 (주가 변동률 기준)
    stabilityThreshold: 0.0,       // 0% 이상이면 안정, 미만이면 불안정
    
    // 연료 효율 계산 상수
    fuelEfficiencyBase: 0.1,       // 기본 연료 소모율
    
    // 거리 계산 상수
    distanceMultiplier: 10.0,      // 거리 증가 배수
    
    // 선체 손상 계산 상수
    hullDamageBase: 5.0,           // 기본 손상량
  },
  
  // 티어 판정 기준
  tiers: {
    S: { minFuel: 70, minHull: 80, maxDistance: 1000 },
    A: { minFuel: 50, minHull: 60 },
    B: { minFuel: 30, minHull: 40 },
    C: { minFuel: 10, minHull: 20 },
    D: { minFuel: 0, minHull: 0 },
  },
};

import { config } from '../config/index.js';
import { InvestingStyle } from '@prisma/client';

interface FlightStats {
  currentFuel: number;
  currentHull: number;
  distance: number;
  totalFuelUsed: number;
  highStabilityThrustCount: number;
  lowStabilityThrustCount: number;
}

interface RocketStats {
  boostStat: number;   // PER - 낮을수록 가속력 높음
  armorStat: number;   // PBR - 낮을수록 내구도 높음
  fuelEcoStat: number; // ROE - 높을수록 연비 좋음
}

/**
 * 중력파 변동률 계산 (주가 변동률)
 */
export function calculateStabilityChange(currentY: number, previousY: number): number {
  if (previousY === 0) return 0;
  return ((currentY - previousY) / previousY) * 100;
}

/**
 * 구간이 안정적(상승)인지 불안정(하락)인지 판단
 */
export function isStableZone(changeRate: number): boolean {
  return changeRate >= config.game.stabilityThreshold;
}

/**
 * 연료 소모량 계산
 * - 기본 소모 + 투입량에 비례한 소모
 * - ROE(fuelEcoStat)가 높을수록 소모량 감소
 */
export function calculateFuelConsumption(
  fuelInput: number,
  rocket: RocketStats
): number {
  const baseConsumption = config.game.fuelEfficiencyBase;
  const inputRatio = fuelInput / 100;
  
  // ROE가 높을수록 연료 효율이 좋음 (소모량 감소)
  const efficiencyMultiplier = 20 / rocket.fuelEcoStat; // ROE 20 기준
  
  return baseConsumption * inputRatio * efficiencyMultiplier * 10;
}

/**
 * 거리 증가량 계산
 * - 안정 구간 + 높은 투입량 = 폭발적 가속
 * - 불안정 구간 + 높은 투입량 = 후퇴 가능
 * - PER(boostStat)이 낮을수록 가속력 높음
 */
export function calculateDistanceChange(
  fuelInput: number,
  changeRate: number,
  rocket: RocketStats
): number {
  const inputRatio = fuelInput / 100;
  const isStable = isStableZone(changeRate);
  
  // PER이 낮을수록 가속력 높음
  const boostMultiplier = 15 / rocket.boostStat; // PER 15 기준
  
  if (isStable) {
    // 상승 구간: 투입량에 비례해 전진
    const baseDistance = Math.abs(changeRate) * inputRatio * config.game.distanceMultiplier;
    return baseDistance * boostMultiplier;
  } else {
    // 하락 구간: 투입량이 높으면 오히려 후퇴할 수 있음
    const damage = Math.abs(changeRate) * inputRatio * 0.5;
    return -damage; // 음수 = 후퇴 또는 정체
  }
}

/**
 * 선체 손상량 계산
 * - 불안정 구간에서 높은 투입 시 손상
 * - PBR(armorStat)이 낮을수록 손상 감소
 */
export function calculateHullDamage(
  fuelInput: number,
  changeRate: number,
  rocket: RocketStats
): number {
  const isStable = isStableZone(changeRate);
  
  if (isStable) {
    // 안정 구간에서는 손상 없음
    return 0;
  }
  
  const inputRatio = fuelInput / 100;
  
  // PBR이 낮을수록 손상 감소
  const armorMultiplier = rocket.armorStat / 1.0; // PBR 1.0 기준
  
  // 투입량이 낮으면 방어 모드로 손상 최소화
  if (fuelInput < 20) {
    return 0; // 방어적 항행
  }
  
  // 불안정 구간 + 높은 투입 = 선체 손상
  const baseDamage = config.game.hullDamageBase * inputRatio * Math.abs(changeRate) / 10;
  return baseDamage * armorMultiplier;
}

/**
 * 티어 판정
 */
export function calculateTier(stats: FlightStats): string {
  const { currentFuel, currentHull, distance } = stats;
  const targetDistance = config.game.targetDistance;
  
  // 화성 도착 실패
  if (distance < targetDistance) {
    return 'F';
  }
  
  // 티어 판정
  if (currentFuel >= config.tiers.S.minFuel && currentHull >= config.tiers.S.minHull) {
    return 'S';
  }
  if (currentFuel >= config.tiers.A.minFuel && currentHull >= config.tiers.A.minHull) {
    return 'A';
  }
  if (currentFuel >= config.tiers.B.minFuel && currentHull >= config.tiers.B.minHull) {
    return 'B';
  }
  if (currentFuel >= config.tiers.C.minFuel && currentHull >= config.tiers.C.minHull) {
    return 'C';
  }
  return 'D';
}

/**
 * 투자 성향 분석
 */
export function analyzeInvestingStyle(stats: FlightStats): InvestingStyle {
  const { highStabilityThrustCount, lowStabilityThrustCount, totalFuelUsed } = stats;
  const totalActions = highStabilityThrustCount + lowStabilityThrustCount;
  
  if (totalActions === 0) {
    return InvestingStyle.DEFENSIVE;
  }
  
  const riskRatio = lowStabilityThrustCount / totalActions;
  const aggressiveRatio = highStabilityThrustCount / totalActions;
  
  // 위험 구간에서 고출력을 많이 낸 경우
  if (riskRatio > 0.4) {
    return InvestingStyle.RISK_TAKER;
  }
  
  // 안정 구간에서 공격적으로 투자한 경우
  if (aggressiveRatio > 0.7 && totalFuelUsed > 50) {
    return InvestingStyle.AGGRESSIVE_GROWTH;
  }
  
  // 연료 사용량이 적고 방어적인 경우
  if (totalFuelUsed < 30) {
    return InvestingStyle.DEFENSIVE;
  }
  
  // 안정 구간에서만 적절히 투자
  if (aggressiveRatio > 0.6 && riskRatio < 0.2) {
    return InvestingStyle.CAUTIOUS_VALUE;
  }
  
  return InvestingStyle.BALANCED_INVESTOR;
}

/**
 * 투자 성향에 따른 조언 생성
 */
export function generateAdvice(style: InvestingStyle, tier: string): string {
  const advices: Record<InvestingStyle, string> = {
    [InvestingStyle.AGGRESSIVE_GROWTH]: 
      '당신은 상승장을 적극 활용하는 공격적 성장주 투자자입니다! 높은 수익을 추구하지만, 실제 시장에서는 분산 투자로 리스크를 관리하세요.',
    [InvestingStyle.BALANCED_INVESTOR]: 
      '균형 잡힌 투자 성향을 보이셨습니다. 위험과 수익의 밸런스를 잘 맞추고 계시네요. 장기적 관점을 유지하면 좋은 결과가 있을 것입니다.',
    [InvestingStyle.CAUTIOUS_VALUE]: 
      '신중한 가치 투자자의 면모를 보이셨습니다! PBR이 낮은 기업, 즉 자산 가치가 탄탄한 기업에 투자하면 안정적인 수익을 기대할 수 있습니다.',
    [InvestingStyle.RISK_TAKER]: 
      '변동성을 즐기시는군요! 하지만 실제 시장에서는 선체 내구도(PBR)을 챙기는 것도 잊지 마세요. 손절라인을 설정하는 습관을 들여보세요.',
    [InvestingStyle.DEFENSIVE]: 
      '안전을 최우선으로 하는 방어적 투자자시네요. 원금 보전에 능하지만, 때로는 적절한 리스크 테이킹이 자산 성장에 도움이 됩니다.',
  };

  let advice = advices[style];
  
  if (tier === 'S') {
    advice += ' 화성에 최고 효율로 도착하셨습니다! 메가 도지 시티를 건설하세요!';
  } else if (tier === 'F') {
    advice += ' 아쉽게도 화성에 도착하지 못했습니다. 다음에는 연료 관리에 더 신경 써보세요!';
  }
  
  return advice;
}

/**
 * 투자 성향 한글 변환
 */
export function getInvestingStyleKorean(style: InvestingStyle): string {
  const styleNames: Record<InvestingStyle, string> = {
    [InvestingStyle.AGGRESSIVE_GROWTH]: '공격적 성장주 투자자',
    [InvestingStyle.BALANCED_INVESTOR]: '균형 잡힌 투자자',
    [InvestingStyle.CAUTIOUS_VALUE]: '신중한 가치 투자자',
    [InvestingStyle.RISK_TAKER]: '위험 감수형 투자자',
    [InvestingStyle.DEFENSIVE]: '방어적 투자자',
  };
  return styleNames[style];
}

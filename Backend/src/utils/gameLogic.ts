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

// 게임 이벤트 인터페이스
interface GameEventData {
  round: number;
  isGlobal: boolean;
  thrustMod: number;
  isTwist: boolean;
  twistType: 'NONE' | 'POSITIVE' | 'NEGATIVE';
  globalType: 'BEAR_TRAP' | 'BULL_RUN' | 'BUBBLE_BURST' | 'NEUTRAL' | null;
  affectedStat: 'boost' | 'armor' | 'fuelEco' | null;
  statMultiplier: number | null;
  targetRocketId: number | null;
}

// 이벤트 결과 인터페이스
interface EventResult {
  thrustMultiplier: number;      // 최종 추력 배율
  fuelModifier: number;          // 연료 소모 배율
  hullDamageModifier: number;    // 선체 손상 배율
  isPositiveOutcome: boolean;    // 최종 결과가 긍정적인지
  description: string;           // 결과 설명
}

/**
 * 라운드 이벤트 + 반전 + 스탯 기반 추력 계산
 * 시나리오에 맞는 복합 로직
 */
export function calculateEventThrust(
  event: GameEventData,
  rocket: RocketStats,
  rocketId: number
): EventResult {
  let thrustMultiplier = event.thrustMod;
  let fuelModifier = 1.0;
  let hullDamageModifier = 1.0;
  let isPositiveOutcome = event.thrustMod >= 1.0;
  let description = '';

  // 특정 로켓 대상 이벤트인데 해당 로켓이 아니면 기본값 반환
  if (!event.isGlobal && event.targetRocketId !== null && event.targetRocketId !== rocketId) {
    return {
      thrustMultiplier: 1.0,
      fuelModifier: 1.0,
      hullDamageModifier: 1.0,
      isPositiveOutcome: true,
      description: '이 이벤트는 다른 로켓에게 적용됩니다.',
    };
  }

  // 스탯 값 가져오기
  const statValue = getStatValue(rocket, event.affectedStat);
  const statMultiplier = event.statMultiplier ?? 0;

  // === Global 이벤트 처리 ===
  if (event.isGlobal && event.globalType) {
    switch (event.globalType) {
      case 'BEAR_TRAP':
        // Round 1: Armor(PBR)가 높은 로켓은 슬링샷 가속
        // 반전 적용: 뉴스는 악재지만, Armor 높으면 반등
        const armorBonus = rocket.armorStat * statMultiplier;
        if (rocket.armorStat >= 1.5) {
          // Armor가 높으면 블랙홀 회전력을 역이용
          thrustMultiplier = event.thrustMod + armorBonus;
          isPositiveOutcome = true;
          description = `🛡️ Armor(${rocket.armorStat.toFixed(1)})로 블랙홀 슬링샷 가속! 추력 x${thrustMultiplier.toFixed(2)}`;
        } else {
          // Armor가 낮으면 블랙홀에 휩쓸림
          thrustMultiplier = event.thrustMod * 0.5;
          hullDamageModifier = 1.5;
          isPositiveOutcome = false;
          description = `💥 Armor 부족! 블랙홀 충격으로 감속. 선체 손상 50% 증가`;
        }
        break;

      case 'BULL_RUN':
        // Round 3: 전 로켓 추력 2배 + Boost(PER)가 높은 성장주 압도적 가속
        const boostBonus = rocket.boostStat * statMultiplier;
        thrustMultiplier = event.thrustMod + boostBonus;
        fuelModifier = 0.8; // 효율적인 환경으로 연료 소모 감소
        isPositiveOutcome = true;
        description = `🚀 Bull Run! Boost(${rocket.boostStat.toFixed(1)})로 가속 x${thrustMultiplier.toFixed(2)}`;
        break;

      case 'BUBBLE_BURST':
        // Round 5: Boost(PER)가 높았던 로켓일수록 감속 폭 커짐
        const boostPenalty = rocket.boostStat * Math.abs(statMultiplier);
        thrustMultiplier = event.thrustMod - boostPenalty;
        thrustMultiplier = Math.max(0.1, thrustMultiplier); // 최소 10%
        isPositiveOutcome = false;
        description = `📉 버블 붕괴! 고Boost 페널티로 추력 x${thrustMultiplier.toFixed(2)}`;
        break;

      default:
        description = '중립 이벤트';
    }
  }
  // === Specific 이벤트 처리 ===
  else if (!event.isGlobal) {
    // 반전 타입에 따른 처리
    if (event.isTwist) {
      if (event.twistType === 'POSITIVE') {
        // 악재 뉴스였지만 실제로는 호재 (반전)
        const bonus = statValue * Math.abs(statMultiplier);
        thrustMultiplier = event.thrustMod + bonus;
        isPositiveOutcome = true;
        description = `🔄 반전(호재)! ${event.affectedStat}(${statValue.toFixed(1)})로 추력 x${thrustMultiplier.toFixed(2)}`;
      } else if (event.twistType === 'NEGATIVE') {
        // 호재 뉴스였지만 실제로는 악재 (반전)
        const penalty = statValue * Math.abs(statMultiplier);
        thrustMultiplier = event.thrustMod - penalty;
        thrustMultiplier = Math.max(0.1, thrustMultiplier);
        isPositiveOutcome = false;
        description = `🔄 반전(악재)! ${event.affectedStat} 역효과로 추력 x${thrustMultiplier.toFixed(2)}`;
      }
    } else {
      // 반전 없음: 뉴스 그대로 적용
      const modifier = statValue * statMultiplier;
      thrustMultiplier = event.thrustMod + modifier;
      isPositiveOutcome = thrustMultiplier >= 1.0;
      description = `📊 이벤트 적용: ${event.affectedStat} 영향으로 추력 x${thrustMultiplier.toFixed(2)}`;
    }

    // 연료 관련 이벤트 처리
    if (event.affectedStat === 'fuelEco') {
      if (statMultiplier > 0) {
        fuelModifier = 1 - (statValue * statMultiplier * 0.1);
        description += ` | 연료 효율 ${((1 - fuelModifier) * 100).toFixed(0)}% 개선`;
      } else {
        fuelModifier = 1 + (statValue * Math.abs(statMultiplier) * 0.1);
        description += ` | 연료 소모 ${((fuelModifier - 1) * 100).toFixed(0)}% 증가`;
      }
    }
  }

  return {
    thrustMultiplier: Math.max(0.1, thrustMultiplier), // 최소 10%
    fuelModifier: Math.max(0.5, Math.min(2.0, fuelModifier)), // 50%~200% 범위
    hullDamageModifier: Math.max(0, hullDamageModifier),
    isPositiveOutcome,
    description,
  };
}

/**
 * 스탯 이름으로 값 가져오기
 */
function getStatValue(rocket: RocketStats, statName: string | null): number {
  switch (statName) {
    case 'boost':
      return rocket.boostStat;
    case 'armor':
      return rocket.armorStat;
    case 'fuelEco':
      return rocket.fuelEcoStat;
    default:
      return 1.0;
  }
}

/**
 * 라운드별 이벤트 효과를 적용한 최종 거리 계산
 */
export function calculateEventBasedDistance(
  baseDistance: number,
  eventResult: EventResult,
  fuelInput: number
): number {
  const inputRatio = fuelInput / 100;
  return baseDistance * eventResult.thrustMultiplier * inputRatio;
}

/**
 * 라운드별 이벤트 효과를 적용한 연료 소모 계산
 */
export function calculateEventBasedFuelConsumption(
  baseFuelConsumption: number,
  eventResult: EventResult
): number {
  return baseFuelConsumption * eventResult.fuelModifier;
}

/**
 * 라운드별 이벤트 효과를 적용한 선체 손상 계산
 */
export function calculateEventBasedHullDamage(
  baseHullDamage: number,
  eventResult: EventResult
): number {
  return baseHullDamage * eventResult.hullDamageModifier;
}

// ============================================
// 정답 판정 및 Final 엔딩 시스템
// ============================================

// Final 엔딩 타입
export type FinalEndingType = 'CRASH' | 'TENT' | 'CITY' | 'INVASION';

interface ChoiceResult {
  isPositiveEvent: boolean;    // 이벤트가 실제로 긍정적이었는지
  userChoseFuel: boolean;      // 유저가 연료 공급을 선택했는지
  isCorrectChoice: boolean;    // 정답 여부
  explanation: string;         // 판정 설명
}

/**
 * 유저의 선택이 정답인지 판정
 * 
 * 정답 로직:
 * - Positive 이벤트 → 연료 공급 O (fuelInput >= 50) = 정답
 * - Negative 이벤트 → 연료 공급 X (fuelInput < 50) = 정답
 */
export function judgeUserChoice(
  fuelInput: number,
  isPositiveOutcome: boolean
): ChoiceResult {
  const userChoseFuel = fuelInput >= 50;
  
  // 긍정적 이벤트 + 연료 공급 = 정답
  // 부정적 이벤트 + 연료 미공급 = 정답
  const isCorrectChoice = isPositiveOutcome === userChoseFuel;
  
  let explanation = '';
  if (isCorrectChoice) {
    if (isPositiveOutcome) {
      explanation = '✅ 정답! 호재를 정확히 읽고 가속했습니다.';
    } else {
      explanation = '✅ 정답! 악재를 간파하고 에너지를 보존했습니다.';
    }
  } else {
    if (isPositiveOutcome) {
      explanation = '❌ 오답! 호재였지만 가속 기회를 놓쳤습니다.';
    } else {
      explanation = '❌ 오답! 악재를 읽지 못하고 에너지를 낭비했습니다.';
    }
  }
  
  return {
    isPositiveEvent: isPositiveOutcome,
    userChoseFuel,
    isCorrectChoice,
    explanation,
  };
}

/**
 * 정답 개수에 따른 Final 엔딩 계산
 * 
 * 0~1개: CRASH (화성 도착 실패)
 * 2~3개: TENT (도지 텐트촌 건설)
 * 4~5개: CITY (도지 도시 건설)
 * 6개: INVASION (도지 지구 침공)
 */
export function calculateFinalEnding(correctAnswers: number): {
  ending: FinalEndingType;
  title: string;
  description: string;
  videoId: string;
} {
  if (correctAnswers >= 6) {
    return {
      ending: 'INVASION',
      title: '🐕→👤 도지 지구 침공',
      description: '완벽한 항해! 도지들이 진화하여 인간의 형태를 갖추고 지구 침공을 시작합니다...',
      videoId: 'ending_invasion',
    };
  }
  
  if (correctAnswers >= 4) {
    return {
      ending: 'CITY',
      title: '🏙️ 도지 시티 건설',
      description: '훌륭한 항해! 화성에 도지들의 번영하는 도시가 건설되었습니다.',
      videoId: 'ending_city',
    };
  }
  
  if (correctAnswers >= 2) {
    return {
      ending: 'TENT',
      title: '⛺ 도지 텐트촌 건설',
      description: '무사히 도착! 자원이 부족하여 텐트촌에서 시작하지만, 희망은 있습니다.',
      videoId: 'ending_tent',
    };
  }
  
  return {
    ending: 'CRASH',
    title: '💥 화성 도착 실패',
    description: '항해에 실패했습니다. 도지들은 우주 미아가 되었습니다...',
    videoId: 'ending_crash',
  };
}

/**
 * 각 라운드별 정답 여부 요약 생성
 */
export function generateRoundSummary(
  roundResults: { round: number; isCorrect: boolean; explanation: string }[]
): string {
  const correctCount = roundResults.filter(r => r.isCorrect).length;
  const summary = roundResults
    .map(r => `R${r.round}: ${r.isCorrect ? '✅' : '❌'}`)
    .join(' | ');
  
  return `${summary}\n총 ${correctCount}/6 정답`;
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

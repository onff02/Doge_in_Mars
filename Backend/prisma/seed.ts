import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 로켓 데이터 초기화 (PER, ROE, PBR 매핑)
  const nvda = await prisma.rocket.upsert({
    where: { name: 'NVDA' },
    update: {},
    create: {
      name: 'NVDA',
      category: 'Growth',
      boost: 1.8,    // PER 기반: 호재 시 폭발력 상
      fuelEco: 1.2,  // ROE 기반
      armor: 1.5,    // PBR 기반
    },
  });

  const aapl = await prisma.rocket.upsert({
    where: { name: 'AAPL' },
    update: {},
    create: {
      name: 'AAPL',
      category: 'Blue-Chip',
      boost: 1.3,
      fuelEco: 1.8,  // ROE 기반: 에너지 효율 최상
      armor: 1.3,
    },
  });

  const ko = await prisma.rocket.upsert({
    where: { name: 'KO' },
    update: {},
    create: {
      name: 'KO',
      category: 'Dividend',
      boost: 1.1,
      fuelEco: 1.1,
      armor: 1.8,    // PBR 기반: 선체 내구도 최고
    },
  });

  // 2. 6라운드 시나리오 데이터 (Global & Specific)
  const events = [
    // --- ROUND 1: Global (Bear Trap) ---
    {
      round: 1,
      isGlobal: true,
      newsTitle: "📡 [심우주 센서] '리먼' 블랙홀 이벤트 발생",
      newsDetail: "🤖 [AI 네비게이터] 함대 파손 확률 90%. 에너지를 보존하고 충격에 대비하십시오.",
      newsLog: "📜 [항해 기록] 2008년 블랙홀 통과 시 함선 파손율 45% 기록.",
      targetRocketId: null,
      thrustMod: 1.5,
      isTwist: true,
      twistType: 'POSITIVE',       // 악재→호재 반전
      globalType: 'BEAR_TRAP',
      affectedStat: 'armor',       // Armor(PBR) 높으면 슬링샷 가속
      statMultiplier: 1.0,         // armor * 1.0 으로 추력 보너스
    },

    // --- ROUND 2: Specific ---
    {
      round: 2,
      isGlobal: false,
      targetRocketId: nvda.id,
      newsTitle: "📡 [심우주 센서] 이더리움 성단 진입 - 보조 추진력 증진",
      newsDetail: "🤖 [AI 네비게이터] 가속 효율 95%. 지금이 최대 출력을 낼 적기입니다.",
      newsLog: "📜 [항해 기록] 2021년 이더리움 성단 통과 시 기록적 가속 확인.",
      thrustMod: 0.5,
      isTwist: true,
      twistType: 'NEGATIVE',       // 호재→악재 반전: 성단 붕괴
      globalType: null,
      affectedStat: 'boost',       // Boost 높을수록 급감속
      statMultiplier: -0.3,        // boost * -0.3 페널티
    },
    {
      round: 2,
      isGlobal: false,
      targetRocketId: aapl.id,
      newsTitle: "📡 [심우주 센서] 제1 은하 '타이탄' 전자기 폭풍 발생",
      newsDetail: "🤖 [AI 네비게이터] 시스템 마비 확률 80%. 모든 센서가 붉게 점멸 중입니다.",
      newsLog: "📜 [항해 기록] 과거 폭풍 발생 시 로켓들의 60%가 마비 경험.",
      thrustMod: 1.6,
      isTwist: true,
      twistType: 'POSITIVE',       // 악재→호재 반전: 노이즈 제거
      globalType: null,
      affectedStat: 'fuelEco',     // FuelEco로 급반등
      statMultiplier: 0.5,         // fuelEco * 0.5 보너스
    },
    {
      round: 2,
      isGlobal: false,
      targetRocketId: ko.id,
      newsTitle: "📡 [심우주 센서] Coke-H2O 정화 비용 절감 성공",
      newsDetail: "🤖 [AI 네비게이터] 운영 효율 15% 상승 예상. 에너지 소모가 줄어듭니다.",
      newsLog: "📜 [항해 기록] 원자재가 하락기 수익 개선 데이터와 일치.",
      thrustMod: 1.1,
      isTwist: false,
      twistType: 'NONE',
      globalType: null,
      affectedStat: 'fuelEco',     // 연료 소모 10% 감소
      statMultiplier: 0.1,
    },

    // --- ROUND 3: Global (Bull Run) ---
    {
      round: 3,
      isGlobal: true,
      newsTitle: "📡 [심우주 센서] 전 항로 에너지 입자 농도 최적화",
      newsDetail: "🤖 [AI 네비게이터] 모든 로켓에 우호적인 환경입니다. 전력 질주하십시오.",
      newsLog: "📜 [항해 기록] 우량 로켓들의 안정적 상승 기록 확인.",
      targetRocketId: null,
      thrustMod: 2.0,
      isTwist: false,
      twistType: 'NONE',
      globalType: 'BULL_RUN',
      affectedStat: 'boost',       // Boost(PER) 비례 가속
      statMultiplier: 1.0,         // boost * 1.0 추력 보너스
    },

    // --- ROUND 4: Specific ---
    {
      round: 4,
      isGlobal: false,
      targetRocketId: nvda.id,
      newsTitle: "📡 [심우주 센서] Generative-Drive 운용 전면 금지",
      newsDetail: "🤖 [AI 네비게이터] 함선 정지 확률 85%. 거대 중력파가 덮칠 것입니다.",
      newsLog: "📜 [항해 기록] 과거 금지 조치 시 엔진 정지 데이터 다수 확인.",
      thrustMod: 1.8,
      isTwist: true,
      twistType: 'POSITIVE',       // 악재→호재 반전: 알고리즘 우회 가속
      globalType: null,
      affectedStat: 'boost',       // Boost 수치만큼 폭발적 가속
      statMultiplier: 0.8,
    },
    {
      round: 4,
      isGlobal: false,
      targetRocketId: aapl.id,
      newsTitle: "📡 [심우주 센서] 연맹의 '궤도 독점' 혐의 조사 시작",
      newsDetail: "🤖 [AI 네비게이터] 에너지 몰수 확률 80%. 출력 저하가 예상됩니다.",
      newsLog: "📜 [항해 기록] 반독점 규제 당시의 출력 저하 데이터와 대조.",
      thrustMod: 0.8,
      isTwist: false,
      twistType: 'NONE',
      globalType: null,
      affectedStat: 'fuelEco',     // 비상 에너지 20% 강제 소모
      statMultiplier: -0.2,
    },
    {
      round: 4,
      isGlobal: false,
      targetRocketId: ko.id,
      newsTitle: "📡 [심우주 센서] 오젬픽 성단에서 재활용 연료 발견",
      newsDetail: "🤖 [AI 네비게이터] 연료 의존도가 낮아집니다. 엔진 효율을 높일 기회입니다.",
      newsLog: "📜 [항해 기록] 효율 증진 로켓들이 일시적으로 등장했던 기록.",
      thrustMod: 0.7,
      isTwist: true,
      twistType: 'NEGATIVE',       // 호재→악재 반전: 구형 엔진 충돌
      globalType: null,
      affectedStat: 'fuelEco',     // 추력 효율 30% 감소
      statMultiplier: -0.3,
    },

    // --- ROUND 5: Global (Bubble Burst) ---
    {
      round: 5,
      isGlobal: true,
      newsTitle: "📡 [심우주 센서] 중력장 수축 시작: 시공간 밀도 증가",
      newsDetail: "🤖 [AI 네비게이터] 밀도 증가로 Boost 성능이 저하됩니다. 기체가 무거워집니다.",
      newsLog: "📜 [항해 기록] 과거 밀도 증가 시기 기체 평균 속도 급감 기록.",
      targetRocketId: null,
      thrustMod: 0.6,
      isTwist: false,
      twistType: 'NONE',
      globalType: 'BUBBLE_BURST',
      affectedStat: 'boost',       // Boost 높을수록 페널티
      statMultiplier: -0.5,        // boost * -0.5 페널티
    },

    // --- ROUND 6: Specific ---
    {
      round: 6,
      isGlobal: false,
      targetRocketId: nvda.id,
      newsTitle: "📡 [심우주 센서] 화성 안착용 AI 항법 장치 최종 인증",
      newsDetail: "🤖 [AI 네비게이터] 정밀 착륙 확률 99%. 자동 항법이 활성화됩니다.",
      newsLog: "📜 [항해 기록] 기술 완성기 데이터와 일치.",
      thrustMod: 1.2,
      isTwist: false,
      twistType: 'NONE',
      globalType: null,
      affectedStat: 'boost',       // 최종 구간 자동 조준
      statMultiplier: 0.2,
    },
    {
      round: 6,
      isGlobal: false,
      targetRocketId: aapl.id,
      newsTitle: "📡 [심우주 센서] 화성 도착 기념 'Anniversary' 실드 배포",
      newsDetail: "🤖 [AI 네비게이터] 마지막 난기류 95% 방어 가능. 무적 상태 진입.",
      newsLog: "📜 [항해 기록] 충성 고객 결집 시기 데이터와 일치.",
      thrustMod: 1.1,
      isTwist: false,
      twistType: 'NONE',
      globalType: null,
      affectedStat: 'armor',       // 마지막 난기류 무적 실드
      statMultiplier: 0.5,
    },
    {
      round: 6,
      isGlobal: false,
      targetRocketId: ko.id,
      newsTitle: "📡 [심우주 센서] 백 년 역사의 안전 비행 인증 갱신",
      newsDetail: "🤖 [AI 네비게이터] 착륙 성공률 99% 유지. 가장 안전한 안착이 예상됩니다.",
      newsLog: "📜 [항해 기록] 이전 100년간의 최종 도착 데이터와 일치.",
      thrustMod: 1.0,
      isTwist: false,
      twistType: 'NONE',
      globalType: null,
      affectedStat: 'armor',       // 착륙 시 선체 손상 0
      statMultiplier: 1.0,
    },
  ];

  for (const event of events) {
    await prisma.gameEvent.create({
      data: event,
    });
  }

  console.log('🚀 화성 항로 시나리오 데이터 시딩 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
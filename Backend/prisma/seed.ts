import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding database...');

  // 로켓 데이터 시드 (PER, PBR, ROE 기반)
  const rockets = [
    {
      name: 'Doge Explorer',
      description: '균형 잡힌 성능의 탐사선. 초보 항해사에게 추천됩니다.',
      boostStat: 15.0,   // PER 15 - 중간 수준의 가속력
      armorStat: 1.2,    // PBR 1.2 - 중간 수준의 내구도
      fuelEcoStat: 12.0, // ROE 12% - 중간 수준의 연비
      imageUrl: '/rockets/explorer.png',
    },
    {
      name: 'Moon Sprinter',
      description: '낮은 PER로 폭발적인 가속력을 자랑합니다. 상승장에 강합니다.',
      boostStat: 8.0,    // PER 8 - 높은 가속력 (낮을수록 강력)
      armorStat: 2.5,    // PBR 2.5 - 약한 내구도
      fuelEcoStat: 8.0,  // ROE 8% - 낮은 연비
      imageUrl: '/rockets/sprinter.png',
    },
    {
      name: 'Mars Fortress',
      description: '낮은 PBR로 단단한 선체를 보유. 하락장에서도 버틸 수 있습니다.',
      boostStat: 25.0,   // PER 25 - 낮은 가속력
      armorStat: 0.6,    // PBR 0.6 - 매우 높은 내구도 (낮을수록 단단함)
      fuelEcoStat: 10.0, // ROE 10% - 보통 연비
      imageUrl: '/rockets/fortress.png',
    },
    {
      name: 'Stellar Cruiser',
      description: '높은 ROE로 연료 효율이 뛰어납니다. 장거리 항해에 최적화.',
      boostStat: 18.0,   // PER 18 - 보통 가속력
      armorStat: 1.5,    // PBR 1.5 - 보통 내구도
      fuelEcoStat: 22.0, // ROE 22% - 매우 높은 연비 (높을수록 알뜰함)
      imageUrl: '/rockets/cruiser.png',
    },
  ];

  for (const rocket of rockets) {
    await prisma.rocket.upsert({
      where: { name: rocket.name },
      update: rocket,
      create: rocket,
    });
  }

  console.log(`✅ Created ${rockets.length} rockets`);
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

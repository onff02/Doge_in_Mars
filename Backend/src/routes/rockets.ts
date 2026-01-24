import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';

export async function rocketRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/rockets
   * 로켓 목록 조회: 인트로 이후 선택 가능한 로켓들의 스택(가속 폭발력, 선체 내구도 등) 정보를 가져옵니다
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rockets = await prisma.rocket.findMany({
        orderBy: { id: 'asc' },
      });

      // 스탯 해석 정보 추가
      const rocketsWithInterpretation = rockets.map((rocket) => ({
        id: rocket.id,
        name: rocket.name,
        description: rocket.description,
        imageUrl: rocket.imageUrl,
        
        // 원본 스탯 (기업 지표)
        rawStats: {
          PER: rocket.boostStat,
          PBR: rocket.armorStat,
          ROE: rocket.fuelEcoStat,
        },
        
        // 게임 스탯 (해석된 값)
        gameStats: {
          boost: {
            value: rocket.boostStat,
            rating: getBoostRating(rocket.boostStat),
            description: '가속 폭발력 - PER 기반 (낮을수록 강력)',
          },
          armor: {
            value: rocket.armorStat,
            rating: getArmorRating(rocket.armorStat),
            description: '선체 내구도 - PBR 기반 (낮을수록 단단함)',
          },
          fuelEco: {
            value: rocket.fuelEcoStat,
            rating: getFuelEcoRating(rocket.fuelEcoStat),
            description: '연비 효율 - ROE 기반 (높을수록 알뜰함)',
          },
        },
        
        // 추천 플레이 스타일
        recommendedStyle: getRecommendedStyle(rocket),
      }));

      return reply.send({
        success: true,
        data: {
          rockets: rocketsWithInterpretation,
          statExplanation: {
            boost: '가속 폭발력(Boost): PER(주가수익비율) 기반. 낮을수록 상승장에서 더 큰 거리를 이동합니다.',
            armor: '선체 내구도(Armor): PBR(주가순자산비율) 기반. 낮을수록 하락장에서 선체 손상이 적습니다.',
            fuelEco: '연비 효율(Fuel Eco): ROE(자기자본이익률) 기반. 높을수록 연료 소모가 적습니다.',
          },
        },
      });
    } catch (error) {
      console.error('Get rockets error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * GET /api/rockets/:id
   * 특정 로켓 상세 정보 조회
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const id = parseInt(request.params.id, 10);

      const rocket = await prisma.rocket.findUnique({
        where: { id },
      });

      if (!rocket) {
        return reply.status(404).send({
          success: false,
          error: '로켓을 찾을 수 없습니다.',
        });
      }

      return reply.send({
        success: true,
        data: {
          id: rocket.id,
          name: rocket.name,
          description: rocket.description,
          imageUrl: rocket.imageUrl,
          rawStats: {
            PER: rocket.boostStat,
            PBR: rocket.armorStat,
            ROE: rocket.fuelEcoStat,
          },
          gameStats: {
            boost: {
              value: rocket.boostStat,
              rating: getBoostRating(rocket.boostStat),
            },
            armor: {
              value: rocket.armorStat,
              rating: getArmorRating(rocket.armorStat),
            },
            fuelEco: {
              value: rocket.fuelEcoStat,
              rating: getFuelEcoRating(rocket.fuelEcoStat),
            },
          },
          recommendedStyle: getRecommendedStyle(rocket),
        },
      });
    } catch (error) {
      console.error('Get rocket error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });
}

// 헬퍼 함수들

function getBoostRating(per: number): string {
  if (per <= 10) return '★★★★★'; // 매우 높은 가속력
  if (per <= 15) return '★★★★☆';
  if (per <= 20) return '★★★☆☆';
  if (per <= 25) return '★★☆☆☆';
  return '★☆☆☆☆';
}

function getArmorRating(pbr: number): string {
  if (pbr <= 0.7) return '★★★★★'; // 매우 높은 내구도
  if (pbr <= 1.0) return '★★★★☆';
  if (pbr <= 1.5) return '★★★☆☆';
  if (pbr <= 2.0) return '★★☆☆☆';
  return '★☆☆☆☆';
}

function getFuelEcoRating(roe: number): string {
  if (roe >= 20) return '★★★★★'; // 매우 높은 연비
  if (roe >= 15) return '★★★★☆';
  if (roe >= 12) return '★★★☆☆';
  if (roe >= 8) return '★★☆☆☆';
  return '★☆☆☆☆';
}

interface RocketData {
  boostStat: number;
  armorStat: number;
  fuelEcoStat: number;
}

function getRecommendedStyle(rocket: RocketData): {
  style: string;
  description: string;
  marketCondition: string;
} {
  // 가장 뛰어난 스탯 찾기
  const boostScore = 30 / rocket.boostStat; // PER은 낮을수록 좋음
  const armorScore = 2 / rocket.armorStat;  // PBR은 낮을수록 좋음
  const fuelScore = rocket.fuelEcoStat / 20; // ROE는 높을수록 좋음

  const maxScore = Math.max(boostScore, armorScore, fuelScore);

  if (maxScore === boostScore) {
    return {
      style: '공격형',
      description: '상승장에서 폭발적인 가속을 할 수 있습니다. 고출력 운용을 추천합니다.',
      marketCondition: '상승장',
    };
  }

  if (maxScore === armorScore) {
    return {
      style: '방어형',
      description: '하락장에서도 안정적인 항해가 가능합니다. 변동성이 큰 항로에 적합합니다.',
      marketCondition: '하락장/변동장',
    };
  }

  return {
    style: '밸런스형',
    description: '연료 효율이 뛰어나 장거리 항해에 유리합니다. 안정적인 운용을 추천합니다.',
    marketCondition: '횡보장',
  };
}

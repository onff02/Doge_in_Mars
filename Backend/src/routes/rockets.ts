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
          PER: rocket.boost,
          PBR: rocket.armor,
          ROE: rocket.fuelEco,
        },
        
        // 게임 스탯 (해석된 값)
        gameStats: {
          boost: {
            value: rocket.boost,
            rating: getBoostRating(rocket.boost),
            description: '가속 폭발력 - PER 기반 (낮을수록 강력)',
          },
          armor: {
            value: rocket.armor,
            rating: getArmorRating(rocket.armor),
            description: '선체 내구도 - PBR 기반 (낮을수록 단단함)',
          },
          fuelEco: {
            value: rocket.fuelEco,
            rating: getFuelEcoRating(rocket.fuelEco),
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
            PER: rocket.boost,
            PBR: rocket.armor,
            ROE: rocket.fuelEco,
          },
          gameStats: {
            boost: {
              value: rocket.boost,
              rating: getBoostRating(rocket.boost),
            },
            armor: {
              value: rocket.armor,
              rating: getArmorRating(rocket.armor),
            },
            fuelEco: {
              value: rocket.fuelEco,
              rating: getFuelEcoRating(rocket.fuelEco),
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
  if (per <= 30) return '★★☆☆☆';
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
  boost: number;
  armor: number;
  fuelEco: number;
}

function getRecommendedStyle(rocket: RocketData) {
  // 스탯별 기여도 계산 (현실적인 주식 지표 기준)
  const boostScore = 15 / rocket.boost;   // PER 15 기준
  const armorScore = 1 / rocket.armor;    // PBR 1.0 기준
  const fuelScore = rocket.fuelEco / 15;  // ROE 15% 기준

  const maxScore = Math.max(boostScore, armorScore, fuelScore);

  if (maxScore === boostScore) {
    return { style: '공격형', description: '상승장에서 폭발적인 가속이 가능합니다.', marketCondition: '상승장' };
  }
  if (maxScore === armorScore) {
    return { style: '방어형', description: '하락장에서도 선체 손상이 거의 없습니다.', marketCondition: '변동장' };
  }
  return { style: '밸런스형', description: '연료 효율이 좋아 안정적인 항해가 가능합니다.', marketCondition: '장거리' };
}

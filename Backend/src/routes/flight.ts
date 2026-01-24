import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';
import { startFlightSchema, syncFlightSchema } from '../schemas/index.js';
import {
  calculateStabilityChange,
  isStableZone,
  calculateFuelConsumption,
  calculateDistanceChange,
  calculateHullDamage,
  calculateTier,
  analyzeInvestingStyle,
  generateAdvice,
  getInvestingStyleKorean,
} from '../utils/gameLogic.js';

export async function flightRoutes(fastify: FastifyInstance) {
  // 모든 라우트에 인증 적용
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * GET /api/flight/status
   * 내 항해 상태 조회: 현재 유저가 인트로를 시청했는지, 진행 중인 섹터가 어디인지 등의 상태를 확인합니다
   */
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nickname: true,
          introViewed: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: '유저를 찾을 수 없습니다.',
        });
      }

      // 진행 중인 세션 조회
      const activeSession = await prisma.flightSession.findFirst({
        where: {
          userId,
          status: 'IN_PROGRESS',
        },
        include: {
          rocket: true,
          _count: {
            select: { logs: true },
          },
        },
      });

      // 완료된 세션들 조회 (최근 5개)
      const completedSessions = await prisma.flightSession.findMany({
        where: {
          userId,
          status: { in: ['COMPLETED', 'FAILED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          rocket: true,
        },
      });

      return reply.send({
        success: true,
        data: {
          introViewed: user.introViewed,
          hasActiveSession: !!activeSession,
          activeSession: activeSession ? {
            id: activeSession.id,
            rocket: activeSession.rocket,
            currentFuel: activeSession.currentFuel,
            currentHull: activeSession.currentHull,
            distance: activeSession.distance,
            symbol: activeSession.symbol,
            progress: (activeSession.distance / config.game.targetDistance) * 100,
            logCount: activeSession._count.logs,
          } : null,
          recentSessions: completedSessions.map((s) => ({
            id: s.id,
            rocket: s.rocket.name,
            tier: s.tier,
            status: s.status,
            createdAt: s.createdAt,
          })),
        },
      });
    } catch (error) {
      console.error('Get status error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * POST /api/flight/reset
   * 새 게임 시작: 기존 항해 데이터를 초기화하고 유저를 인트로/로켓 선택 단계로 되돌립니다
   */
  fastify.post('/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;

      // 진행 중인 세션을 FAILED로 변경
      await prisma.flightSession.updateMany({
        where: {
          userId,
          status: 'IN_PROGRESS',
        },
        data: {
          status: 'FAILED',
        },
      });

      return reply.send({
        success: true,
        message: '게임이 초기화되었습니다. 새로운 항해를 시작하세요!',
      });
    } catch (error) {
      console.error('Reset error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * POST /api/flight/intro-complete
   * 인트로 완료 처리: 인트로 영상 시청 완료를 기록하여 다음 접속 시 인트로를 건너뛰게 합니다
   */
  fastify.post('/intro-complete', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;

      await prisma.user.update({
        where: { id: userId },
        data: { introViewed: true },
      });

      return reply.send({
        success: true,
        message: '인트로 시청이 완료되었습니다.',
      });
    } catch (error) {
      console.error('Intro complete error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * POST /api/flight/start
   * 항해 개시: 선택한 로켓과 항로로 실제 항해 세션을 생성하고 시작 지점을 할당합니다
   */
  fastify.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;
      const body = startFlightSchema.parse(request.body);
      const { rocketId, symbol } = body;

      // 이미 진행 중인 세션이 있는지 확인
      const existingSession = await prisma.flightSession.findFirst({
        where: {
          userId,
          status: 'IN_PROGRESS',
        },
      });

      if (existingSession) {
        return reply.status(400).send({
          success: false,
          error: '이미 진행 중인 항해가 있습니다. 먼저 완료하거나 초기화해주세요.',
          sessionId: existingSession.id,
        });
      }

      // 로켓 존재 확인
      const rocket = await prisma.rocket.findUnique({
        where: { id: rocketId },
      });

      if (!rocket) {
        return reply.status(404).send({
          success: false,
          error: '선택한 로켓을 찾을 수 없습니다.',
        });
      }

      // 새 세션 생성
      const session = await prisma.flightSession.create({
        data: {
          userId,
          rocketId,
          symbol,
          currentFuel: config.game.initialFuel,
          currentHull: config.game.initialHull,
          distance: 0,
          status: 'IN_PROGRESS',
        },
        include: {
          rocket: true,
        },
      });

      return reply.status(201).send({
        success: true,
        data: {
          session: {
            id: session.id,
            rocket: session.rocket,
            currentFuel: session.currentFuel,
            currentHull: session.currentHull,
            distance: session.distance,
            symbol: session.symbol,
            targetDistance: config.game.targetDistance,
          },
          message: `${rocket.name}호로 ${symbol} 항로 항해를 시작합니다!`,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: '입력값이 올바르지 않습니다.',
          details: error,
        });
      }
      console.error('Start flight error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * POST /api/flight/sync
   * 실시간 항해 동기화: 유저의 연료 출력값을 전송하여 실시간 위치, 연료, 선체 내구도를 갱신합니다
   */
  fastify.post('/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;
      const body = syncFlightSchema.parse(request.body);
      const { fuelInput, yValue, previousYValue } = body;

      // 진행 중인 세션 조회
      const session = await prisma.flightSession.findFirst({
        where: {
          userId,
          status: 'IN_PROGRESS',
        },
        include: {
          rocket: true,
        },
      });

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: '진행 중인 항해가 없습니다.',
        });
      }

      const rocket = {
        boostStat: session.rocket.boostStat,
        armorStat: session.rocket.armorStat,
        fuelEcoStat: session.rocket.fuelEcoStat,
      };

      // 중력파 변동률 계산
      const prevY = previousYValue ?? yValue;
      const changeRate = calculateStabilityChange(yValue, prevY);
      const isStable = isStableZone(changeRate);

      // 연료 소모 계산
      const fuelConsumed = calculateFuelConsumption(fuelInput, rocket);
      const newFuel = Math.max(0, session.currentFuel - fuelConsumed);

      // 거리 변화 계산
      const distanceChange = calculateDistanceChange(fuelInput, changeRate, rocket);
      const newDistance = Math.max(0, session.distance + distanceChange);

      // 선체 손상 계산
      const hullDamage = calculateHullDamage(fuelInput, changeRate, rocket);
      const newHull = Math.max(0, session.currentHull - hullDamage);

      // 투자 성향 분석용 카운트 업데이트
      const isHighThrust = fuelInput >= 50;
      const highStabilityThrustIncrement = isStable && isHighThrust ? 1 : 0;
      const lowStabilityThrustIncrement = !isStable && isHighThrust ? 1 : 0;

      // 세션 상태 확인
      let newStatus = session.status;
      let isGameOver = false;
      let gameOverReason = '';

      // 연료 고갈 또는 선체 파괴 체크
      if (newFuel <= 0 || newHull <= 0) {
        newStatus = 'FAILED';
        isGameOver = true;
        gameOverReason = newFuel <= 0 ? '연료가 고갈되었습니다!' : '선체가 파괴되었습니다!';
      }

      // 목표 거리 도달 체크
      if (newDistance >= config.game.targetDistance) {
        newStatus = 'COMPLETED';
        isGameOver = true;
        gameOverReason = '화성에 도착했습니다!';
      }

      // 세션 업데이트
      const updatedSession = await prisma.flightSession.update({
        where: { id: session.id },
        data: {
          currentFuel: newFuel,
          currentHull: newHull,
          distance: Math.min(newDistance, config.game.targetDistance),
          totalFuelUsed: { increment: fuelConsumed },
          highStabilityThrustCount: { increment: highStabilityThrustIncrement },
          lowStabilityThrustCount: { increment: lowStabilityThrustIncrement },
          status: newStatus,
        },
      });

      // 로그 기록
      await prisma.flightLog.create({
        data: {
          sessionId: session.id,
          yValue,
          fuelInput,
          fuelAfter: newFuel,
          hullAfter: newHull,
          distanceAfter: updatedSession.distance,
        },
      });

      return reply.send({
        success: true,
        data: {
          currentFuel: newFuel,
          currentHull: newHull,
          distance: updatedSession.distance,
          progress: (updatedSession.distance / config.game.targetDistance) * 100,
          
          // 이번 틱 결과
          fuelConsumed,
          distanceChange,
          hullDamage,
          
          // 중력파 상태
          isStableZone: isStable,
          changeRate,
          
          // 게임 상태
          status: newStatus,
          isGameOver,
          gameOverReason,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: '입력값이 올바르지 않습니다.',
          details: error,
        });
      }
      console.error('Sync flight error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * POST /api/flight/ending
   * 착륙 판정 요청: 티어 판정 및 항해 데이터를 분석하여 투자 성향 및 조언을 생성합니다
   */
  fastify.post('/ending', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;

      // 가장 최근 세션 조회 (완료/실패 상태)
      const session = await prisma.flightSession.findFirst({
        where: {
          userId,
          status: { in: ['COMPLETED', 'FAILED', 'IN_PROGRESS'] },
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          rocket: true,
          logs: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: '분석할 항해 기록이 없습니다.',
        });
      }

      // 진행 중이면 강제 종료
      if (session.status === 'IN_PROGRESS') {
        const reachedTarget = session.distance >= config.game.targetDistance;
        await prisma.flightSession.update({
          where: { id: session.id },
          data: {
            status: reachedTarget ? 'COMPLETED' : 'FAILED',
          },
        });
      }

      // 티어 계산
      const tier = calculateTier({
        currentFuel: session.currentFuel,
        currentHull: session.currentHull,
        distance: session.distance,
        totalFuelUsed: session.totalFuelUsed,
        highStabilityThrustCount: session.highStabilityThrustCount,
        lowStabilityThrustCount: session.lowStabilityThrustCount,
      });

      // 투자 성향 분석
      const investingStyle = analyzeInvestingStyle({
        currentFuel: session.currentFuel,
        currentHull: session.currentHull,
        distance: session.distance,
        totalFuelUsed: session.totalFuelUsed,
        highStabilityThrustCount: session.highStabilityThrustCount,
        lowStabilityThrustCount: session.lowStabilityThrustCount,
      });

      // 조언 생성
      const advice = generateAdvice(investingStyle, tier);

      // 세션 결과 업데이트
      await prisma.flightSession.update({
        where: { id: session.id },
        data: {
          tier,
          investingStyle,
          advice,
          status: tier === 'F' ? 'FAILED' : 'COMPLETED',
        },
      });

      // 티어별 마을 상태
      const villageStatus = {
        S: { name: '메가 도지 시티', description: '황금빛 도시가 세워졌습니다!', emoji: '🏙️✨' },
        A: { name: '도지 정착촌', description: '안정적인 마을이 형성되었습니다.', emoji: '🏘️' },
        B: { name: '도지 마을', description: '평화로운 마을이 세워졌습니다.', emoji: '🏠' },
        C: { name: '도지 텐트촌', description: '도지들이 고생하며 마을을 세웠습니다.', emoji: '⛺' },
        D: { name: '도지 텐트촌', description: '간신히 도착하여 작은 텐트를 쳤습니다.', emoji: '🎪' },
        F: { name: '착륙 실패', description: '화성에 도착하지 못했습니다...', emoji: '💫' },
      };

      return reply.send({
        success: true,
        data: {
          // 기본 결과
          tier,
          village: villageStatus[tier as keyof typeof villageStatus],
          
          // 투자 성향 분석
          investingStyle,
          investingStyleKorean: getInvestingStyleKorean(investingStyle),
          advice,
          
          // 항해 통계
          stats: {
            finalFuel: session.currentFuel,
            finalHull: session.currentHull,
            totalDistance: session.distance,
            totalFuelUsed: session.totalFuelUsed,
            highStabilityThrustCount: session.highStabilityThrustCount,
            lowStabilityThrustCount: session.lowStabilityThrustCount,
            totalActions: session.logs.length,
          },
          
          // 로켓 정보 (실제 기업 데이터 매핑)
          rocketInfo: {
            name: session.rocket.name,
            description: session.rocket.description,
            stats: {
              PER: session.rocket.boostStat,
              PBR: session.rocket.armorStat,
              ROE: session.rocket.fuelEcoStat,
            },
          },
          
          // 항로 정보
          route: {
            symbol: session.symbol,
            message: `당신이 항해한 항로는 실제 '${session.symbol}' 기업의 주가 데이터였습니다.`,
          },
        },
      });
    } catch (error) {
      console.error('Ending error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * GET /api/flight/logs/:sessionId
   * 특정 세션의 항해 로그 조회
   */
  fastify.get('/logs/:sessionId', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { userId } = request.user;
      const sessionId = parseInt(request.params.sessionId, 10);

      const session = await prisma.flightSession.findFirst({
        where: {
          id: sessionId,
          userId, // 본인의 세션만 조회 가능
        },
        include: {
          logs: {
            orderBy: { timestamp: 'asc' },
          },
          rocket: true,
        },
      });

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: '항해 기록을 찾을 수 없습니다.',
        });
      }

      return reply.send({
        success: true,
        data: {
          session: {
            id: session.id,
            rocket: session.rocket.name,
            symbol: session.symbol,
            status: session.status,
            tier: session.tier,
          },
          logs: session.logs,
        },
      });
    } catch (error) {
      console.error('Get logs error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });
}

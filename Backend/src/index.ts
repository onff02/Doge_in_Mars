import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config/index.js';
import { authenticate } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { flightRoutes } from './routes/flight.js';
import { rocketRoutes } from './routes/rockets.js';
import { chartRoutes } from './routes/charts.js';
import { analysisRoutes } from './routes/analysis.js';
import prisma from './lib/prisma.js';

// Fastify 인스턴스 생성
const fastify = Fastify({
  logger: process.env.NODE_ENV === 'development' ? true : false,
});

// authenticate 데코레이터 타입 선언
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

async function buildApp() {
  // CORS 설정
  await fastify.register(cors, {
    origin: true, // 개발 환경에서는 모든 origin 허용
    credentials: true,
  });

  // JWT 설정
  await fastify.register(jwt, {
    secret: config.jwtSecret,
    sign: {
      expiresIn: '7d', // 7일 만료
    },
  });

  // authenticate 데코레이터 등록
  fastify.decorate('authenticate', authenticate);

  // Swagger 문서화
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: '🚀 Doge City in Mars API',
        description: '화성 갈끄니까 - 데이터 기반 항로 최적화 게임 백엔드 API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // 헬스 체크
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // API 루트
  fastify.get('/api', async () => {
    return {
      name: '🚀 Doge City in Mars API',
      version: '1.0.0',
      description: '화성 갈끄니까 - 데이터 기반 항로 최적화 게임',
      endpoints: {
        auth: '/api/auth',
        flight: '/api/flight',
        rockets: '/api/rockets',
        charts: '/api/charts',
        analysis: '/api/analysis',
      },
      docs: '/docs',
    };
  });

  fastify.get('/api/db-test', async () => {
    try {
      // Prisma를 사용하여 간단한 DB 쿼리 실행 (예: 로켓 목록 개수 확인)
      const rocketCount = await prisma.rocket.count(); 
      return {
        success: true,
        message: "RDS 데이터베이스와 연결되었습니다!",
        rocketCount
      };
    } catch (error) {
      return {
        success: false,
        error: "DB 연결에 실패했습니다."
      };
    }
  });

  // 라우트 등록
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(flightRoutes, { prefix: '/api/flight' });
  await fastify.register(rocketRoutes, { prefix: '/api/rockets' });
  await fastify.register(chartRoutes, { prefix: '/api/charts' });
  await fastify.register(analysisRoutes, { prefix: '/api/analysis' });

  // 에러 핸들러
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: '입력값 검증 실패',
        details: error.validation,
      });
    }

    return reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || '서버 오류가 발생했습니다.',
    });
  });

  // 404 핸들러
  fastify.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      success: false,
      error: '요청한 리소스를 찾을 수 없습니다.',
      path: request.url,
    });
  });

  return fastify;
}

// 서버 시작
async function start() {
  try {
    const app = await buildApp();

    // 데이터베이스 연결 확인
    await prisma.$connect();
    console.log('📦 Database connected');

    // 서버 시작
    await app.listen({ port: config.port, host: config.host });
    
    console.log(`
    🚀 ================================== 🚀
    
       Doge City in Mars Backend
       화성 갈끄니까 API Server
    
    🚀 ================================== 🚀
    
    📍 Server: http://${config.host}:${config.port}
    📚 API Docs: http://localhost:${config.port}/docs
    ❤️  Health: http://localhost:${config.port}/health
    
    📋 Available Endpoints:
       POST /api/auth/register    - 회원가입
       POST /api/auth/login       - 로그인
       GET  /api/auth/me          - 내 정보 조회
       
       GET  /api/flight/status    - 항해 상태 조회
       POST /api/flight/reset     - 게임 초기화
       POST /api/flight/intro-complete - 인트로 완료
       POST /api/flight/start     - 항해 시작
       POST /api/flight/sync      - 실시간 동기화
       POST /api/flight/ending    - 착륙 판정
       
       GET  /api/rockets          - 로켓 목록
       GET  /api/rockets/:id      - 로켓 상세
       
       GET  /api/charts           - 고정 항로 중력파 데이터 (DOGE)
       GET  /api/charts/live      - 실시간 중력파 데이터
    `);

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();

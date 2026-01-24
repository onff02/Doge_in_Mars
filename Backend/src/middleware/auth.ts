import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// JWT 페이로드 타입
export interface JWTPayload {
  userId: number;
  email: string;
}

// 인증 미들웨어
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ 
      success: false, 
      error: '인증이 필요합니다. 로그인 후 다시 시도해주세요.' 
    });
  }
}

// FastifyRequest 타입 확장을 위한 선언
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

// 인증 플러그인 등록
export function registerAuthHook(fastify: FastifyInstance) {
  fastify.decorate('authenticate', authenticate);
}

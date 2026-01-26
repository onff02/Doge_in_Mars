import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { registerSchema, loginSchema, RegisterInput, LoginInput } from '../schemas/index.js';

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/auth/register
   * 회원가입: 새로운 사용자 계정을 생성합니다
   */
  fastify.post('/register', {
    schema: {
      summary: '신규 유저 회원가입',
      description: '이메일, 비밀번호, 닉네임을 받아 새로운 유저를 생성하고 JWT 토큰을 발급합니다.',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'nickname'],
        properties: {
          email: { type: 'string', format: 'email', description: '사용자 이메일' },
          password: { type: 'string', minLength: 6, description: '비밀번호 (6자 이상)' },
          nickname: { type: 'string', description: '서비스에서 사용할 닉네임' },
        },
      },
      response: {
        201: {
          description: '회원가입 성공',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    email: { type: 'string' },
                    nickname: { type: 'string' },
                    introViewed: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' }
                  }
                },
                token: { type: 'string', description: 'JWT Access Token' }
              }
            }
          }
        },
        400: {
          description: '입력값 검증 실패 (Zod Error)',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: '입력값이 올바르지 않습니다.' },
            details: { type: 'object', additionalProperties: true }
          }
        },
        409: {
          description: '이메일 중복',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: '이미 사용 중인 이메일입니다.' }
          }
        },
        500: {
          description: '서버 오류',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: '서버 오류가 발생했습니다.' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);
      const { email, password, nickname } = body;

      // 이메일 중복 확인
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(409).send({
          success: false,
          error: '이미 사용 중인 이메일입니다.',
        });
      }

      // 비밀번호 해싱
      const hashedPassword = await bcrypt.hash(password, 10);

      // 유저 생성
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nickname,
        },
        select: {
          id: true,
          email: true,
          nickname: true,
          introViewed: true,
          createdAt: true,
        },
      });

      // JWT 토큰 생성
      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
      });

      return reply.status(201).send({
        success: true,
        data: {
          user,
          token,
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
      console.error('Register error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * POST /api/auth/login
   * 로그인: 인증 후 토큰과 함께 기존 항해 데이터 존재 여부를 응답받습니다
   */
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      const { email, password } = body;

      // 유저 조회
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          sessions: {
            where: { status: 'IN_PROGRESS' },
            take: 1,
          },
        },
      });

      if (!user) {
        return reply.status(401).send({
          success: false,
          error: '이메일 또는 비밀번호가 일치하지 않습니다.',
        });
      }

      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return reply.status(401).send({
          success: false,
          error: '이메일 또는 비밀번호가 일치하지 않습니다.',
        });
      }

      // JWT 토큰 생성
      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email,
      });

      // 활성 세션 존재 여부
      const hasActiveSession = user.sessions.length > 0;

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            introViewed: user.introViewed,
            createdAt: user.createdAt,
          },
          token,
          hasActiveSession,          // 진행 중인 항해 세션 존재 여부
          introViewed: user.introViewed, // 인트로 시청 여부
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
      console.error('Login error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * GET /api/auth/me
   * 현재 로그인한 유저 정보 조회
   */
  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nickname: true,
          introViewed: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: '유저를 찾을 수 없습니다.',
        });
      }

      // 활성 세션 조회
      const activeSession = await prisma.flightSession.findFirst({
        where: {
          userId,
          status: 'IN_PROGRESS',
        },
        include: {
          rocket: true,
        },
      });

      return reply.send({
        success: true,
        data: {
          user,
          hasActiveSession: !!activeSession,
          activeSession,
        },
      });
    } catch (error) {
      console.error('Get me error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });
}

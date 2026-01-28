import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import OpenAI from 'openai';
import { z } from 'zod';

const decisionSchema = z.object({
  round: z.number().int().min(1),
  symbol: z.string().min(1).max(10),
  choice: z.enum(['up', 'down']),
  correct: z.boolean(),
  correctDirection: z.enum(['up', 'down']).optional(),
});

const analysisRequestSchema = z.object({
  decisions: z.array(decisionSchema).min(1),
});

type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analysisRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  /**
   * POST /api/analysis/decision
   * 선택 기록을 기반으로 성향 분석을 생성합니다
   */
  fastify.post(
    '/decision',
    async (request: FastifyRequest<{ Body: AnalysisRequest }>, reply: FastifyReply) => {
      try {
        if (!process.env.OPENAI_API_KEY) {
          return reply.status(500).send({
            success: false,
            error: 'OPENAI_API_KEY가 설정되지 않았습니다.',
          });
        }

        const { decisions } = analysisRequestSchema.parse(request.body);
        const total = decisions.length;
        const correct = decisions.filter((item) => item.correct).length;
        const upCount = decisions.filter((item) => item.choice === 'up').length;
        const downCount = total - upCount;
        const accuracy = Math.round((correct / total) * 100);
        const upRate = Math.round((upCount / total) * 100);
        const downRate = Math.round((downCount / total) * 100);

        const compactDecisions = decisions.map((item) => ({
          round: item.round,
          symbol: item.symbol,
          choice: item.choice,
          correct: item.correct,
          correctDirection: item.correctDirection,
        }));

        const instructions =
          '너는 투자 선택 성향을 분석하는 전문가다. 한국어로 3~5문장 이내로 간단명료하게 요약해라. ' +
          '리스크 성향, 변동성 선호, 안정성 선호를 포함하고, 마지막 문장은 짧은 조언으로 끝내라. 이모지는 쓰지 마라.';

        const input = JSON.stringify(
          {
            summary: {
              total,
              correct,
              accuracy,
              upRate,
              downRate,
            },
            decisions: compactDecisions,
          },
          null,
          0
        );

        const response = await openai.responses.create({
          model: process.env.OPENAI_MODEL || 'gpt-5',
          instructions,
          input,
        });

        const analysis = response.output_text?.trim() || '';
        if (!analysis) {
          return reply.status(500).send({
            success: false,
            error: '분석 결과를 생성하지 못했습니다.',
          });
        }

        return reply.send({
          success: true,
          data: { analysis },
        });
      } catch (error) {
        console.error('Decision analysis error:', error);
        return reply.status(500).send({
          success: false,
          error: '분석 요청에 실패했습니다.',
        });
      }
    }
  );
}

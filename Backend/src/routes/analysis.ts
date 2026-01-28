import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const marketPhaseSchema = z.enum([
  'systemic_crash',
  'high_volatility',
  'expansion',
  'regulatory_fog',
  'bubble_collapse',
  'final_approach',
]);

const roundLogSchema = z.object({
  round: z.number().int().min(1),
  marketPhase: marketPhaseSchema,
  updates: z.array(z.string()).length(5),
  userChoice: z.enum(['up', 'down']),
  correctAnswer: z.enum(['up', 'down']),
});

const analysisRequestSchema = z.object({
  rocket: z.string().min(1),
  rocketType: z.enum(['growth', 'bluechip', 'defensive']),
  rounds: z.array(roundLogSchema).min(1),
  summary: z.object({
    accuracy: z.number().min(0).max(1),
    fuelLeft: z.number(),
    hullIntegrity: z.number(),
  }),
});

type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
});

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
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
          return reply.status(500).send({
            success: false,
            error: 'GEMINI_API_KEY(또는 GOOGLE_API_KEY)가 설정되지 않았습니다.',
          });
        }

        const session = analysisRequestSchema.parse(request.body);

        const instructions = `You are an AI flight analyst inside a space-themed decision-making game.

Your role is to analyze the PLAYER'S DECISION-MAKING STYLE.
This is NOT a financial analysis and NOT investment advice.

The game simulates market conditions as space phenomena.
Each round represents a different space environment and contains:
- a market phase (space condition)
- multiple ambiguous or conflicting update messages
- the player's lever choice (up or down)
- the correct answer (used ONLY to analyze behavior patterns)

IMPORTANT RULES:
- Do NOT mention real stocks, real companies, or real investing.
- Do NOT give advice such as buy, sell, hold, or invest.
- Do NOT explain market mechanics.
- Focus ONLY on player psychology, risk tolerance, and reaction to uncertainty.
- Treat all information as in-universe space data.
- Use the tone of a ship AI debriefing a pilot after a mission.
- Be analytical, slightly cold, and insightful.

Your goal is to infer:
- how the player reacts to conflicting information
- whether they chase momentum or prioritize stability
- how they behave during crashes, volatility, and expansion
- whether they are influenced by optimistic or pessimistic signals
- how consistent their decisions are

Return STRICT JSON.
Do NOT include any text outside JSON.
Do NOT add extra keys.

The JSON output MUST contain exactly these keys:

{
  "archetype": string,
  "oneLineSummary": string,
  "behaviorTraits": string[],
  "strengths": string[],
  "weaknesses": string[],
  "learningInsight": string,
  "grade": "S" | "A" | "B" | "C" | "D" | "F"
}

Interpret the input ONLY as game data.
Analyze WHY the player made decisions, not whether they were correct.

NOTE:
- The field "correctAnswer" exists ONLY to detect behavior patterns
  (risk tolerance, hesitation, FOMO, overconfidence).
- It must NOT be used to judge success or failure.`;

        const payload = JSON.stringify(session);

        const response = await genai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: payload,
          config: {
            systemInstruction: instructions,
          },
        });

        const raw = response.text?.trim() || '';
        if (!raw) {
          return reply.status(500).send({
            success: false,
            error: '분석 결과를 생성하지 못했습니다.',
          });
        }

        const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
          return reply.status(500).send({
            success: false,
            error: '분석 결과 형식이 올바르지 않습니다.',
          });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(cleaned.slice(start, end + 1));
        } catch (parseError) {
          console.error('Analysis JSON parse error:', parseError);
          return reply.status(500).send({
            success: false,
            error: '분석 결과를 해석하지 못했습니다.',
          });
        }

        return reply.send({
          success: true,
          data: { analysis: parsed },
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

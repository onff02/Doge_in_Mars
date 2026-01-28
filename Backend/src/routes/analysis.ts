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

        const instructions = `너는 우주 테마 의사결정 게임 안의 비행 분석 AI다.

역할: 플레이어의 의사결정 성향을 분석한다.
이것은 금융 분석이 아니며, 투자 조언이 아니다.

게임 설정:
- 각 라운드는 우주 환경(시장 국면)을 의미한다
- 모호하거나 상충하는 업데이트가 포함된다
- 플레이어의 레버 선택(up/down)이 기록된다
- correctAnswer는 행동 패턴 분석을 위한 참고값일 뿐이다

중요 규칙:
- 실제 종목/기업/투자 용어를 언급하지 마라
- 매수/매도/보유/투자 같은 조언을 금지한다
- 시장 메커니즘 설명 금지
- 플레이어의 심리, 리스크 성향, 불확실성 반응만 분석
- 모든 정보는 게임 내 우주 데이터로 취급
- 임무 종료 후 함장을 브리핑하는 함선 AI 톤으로 작성
- 분석적이고 약간 냉정하며 통찰적으로 작성
- 모든 출력 텍스트는 반드시 한국어로만 작성 (영어 금지)
- 반드시 이 게임이 "주식 기반 시뮬레이션"임을 명시하되, 실제 종목/기업 이름은 언급하지 마라
- oneLineSummary 문장에 "주식 기반"이라는 표현을 반드시 포함하라

분석 포인트:
- 상충 정보에 대한 반응
- 모멘텀 추종 vs 안정성 선호
- 붕괴/변동성/확장 구간에서의 행동
- 낙관/비관 신호에 대한 영향
- 선택 일관성

출력 형식:
- STRICT JSON만 출력
- JSON 밖의 텍스트 금지
- 키 추가 금지

JSON 키 (정확히 이 순서/이 이름):
{
  "archetype": string,
  "oneLineSummary": string,
  "behaviorTraits": string[],
  "strengths": string[],
  "weaknesses": string[],
  "learningInsight": string,
  "grade": "S" | "A" | "B" | "C" | "D" | "F"
}

정답 여부는 성공 판단에 쓰지 말고, 성향 패턴 인식에만 사용해라.`;

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

        const containsKorean = (value: string) => /[가-힣]/.test(value);
        const needsRewrite = (analysis: any) => {
          if (!analysis || typeof analysis !== 'object') return true;
          const requiredKeys = [
            'archetype',
            'oneLineSummary',
            'behaviorTraits',
            'strengths',
            'weaknesses',
            'learningInsight',
            'grade',
          ];
          for (const key of requiredKeys) {
            if (!(key in analysis)) return true;
          }
          const stringsToCheck: string[] = [
            analysis.archetype,
            analysis.oneLineSummary,
            analysis.learningInsight,
          ];
          const listFields = [analysis.behaviorTraits, analysis.strengths, analysis.weaknesses];
          for (const list of listFields) {
            if (Array.isArray(list)) {
              for (const item of list) {
                if (typeof item === 'string') stringsToCheck.push(item);
              }
            }
          }
          if (!analysis.oneLineSummary || !String(analysis.oneLineSummary).includes('주식 기반')) return true;
          return stringsToCheck.some((text) => typeof text !== 'string' || !containsKorean(text));
        };

        const buildFallback = (input: AnalysisRequest) => {
          const total = input.rounds.length;
          const upCount = input.rounds.filter((r) => r.userChoice === 'up').length;
          const downCount = total - upCount;
          const upRate = total ? upCount / total : 0;
          const switchCount = input.rounds.reduce((count, r, idx, arr) => {
            if (idx === 0) return 0;
            return count + (arr[idx - 1].userChoice !== r.userChoice ? 1 : 0);
          }, 0);
          const switchRate = total > 1 ? switchCount / (total - 1) : 0;
          const riskPhases = new Set(['systemic_crash', 'high_volatility', 'bubble_collapse']);
          const upInRisk = input.rounds.filter((r) => riskPhases.has(r.marketPhase) && r.userChoice === 'up').length;

          let archetype = '균형 조종형';
          if (upRate >= 0.7) archetype = '공세적 추진형';
          else if (upRate <= 0.3) archetype = '방어적 안정형';

          const behaviorTraits: string[] = [];
          if (upRate >= 0.7) behaviorTraits.push('불확실 구간에서도 추진 결정을 선호한다');
          if (upRate <= 0.3) behaviorTraits.push('위험 신호에 민감하게 반응하며 방어를 택한다');
          behaviorTraits.push(switchRate >= 0.5 ? '상황 변화에 따라 결정을 자주 전환한다' : '선택 일관성이 높은 편이다');
          if (upInRisk >= 2) behaviorTraits.push('위기 구간에서도 반등 가능성에 무게를 둔다');

          const strengths: string[] = [];
          const weaknesses: string[] = [];
          if (upRate >= 0.7) {
            strengths.push('기회 신호를 빠르게 포착하고 결단이 빠르다');
            weaknesses.push('위기 구간의 리스크를 과소평가할 수 있다');
          } else if (upRate <= 0.3) {
            strengths.push('불확실성 속에서도 손실 관리에 집중한다');
            weaknesses.push('확장 구간에서 기회를 놓칠 수 있다');
          } else {
            strengths.push('상황에 따라 판단을 조정하는 유연성이 있다');
            weaknesses.push('결정 기준이 모호해질 때 주저할 수 있다');
          }
          strengths.push(switchRate < 0.5 ? '선택 기준이 비교적 일관되다' : '환경 변화에 기민하게 반응한다');
          weaknesses.push(switchRate >= 0.5 ? '신호 혼재 시 방향성이 흔들릴 수 있다' : '변화에 대한 민감도가 낮을 수 있다');

          return {
            archetype,
            oneLineSummary: `주식 기반 시뮬레이션에서 ${archetype} 성향이 드러났으며, 불확실성 속 선택 기준이 뚜렷하다.`,
            behaviorTraits: behaviorTraits.slice(0, 4),
            strengths: strengths.slice(0, 3),
            weaknesses: weaknesses.slice(0, 3),
            learningInsight: '상충 신호 구간에서는 한 박자 관측 후 조정하는 루틴을 두면 안정성이 높아진다.',
            grade: 'B',
          };
        };

        let finalAnalysis = parsed as any;
        if (needsRewrite(finalAnalysis)) {
          const rewriteInstruction = `다음 JSON의 모든 문자열 값을 한국어로만 다시 작성하라.
영어/외국어를 포함하지 마라. JSON 외 텍스트는 출력하지 마라.
키/구조/배열 길이는 그대로 유지하라.
oneLineSummary에는 반드시 "주식 기반"이라는 표현을 포함하라.`;
          const rewriteResponse = await genai.models.generateContent({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            contents: JSON.stringify(finalAnalysis),
            config: {
              systemInstruction: rewriteInstruction,
            },
          });
          const rewrittenRaw = rewriteResponse.text?.trim() || '';
          const rewrittenClean = rewrittenRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const rStart = rewrittenClean.indexOf('{');
          const rEnd = rewrittenClean.lastIndexOf('}');
          if (rStart !== -1 && rEnd !== -1 && rEnd > rStart) {
            try {
              finalAnalysis = JSON.parse(rewrittenClean.slice(rStart, rEnd + 1));
            } catch (rewriteError) {
              console.error('Rewrite JSON parse error:', rewriteError);
            }
          }
        }

        if (needsRewrite(finalAnalysis)) {
          finalAnalysis = buildFallback(session);
        }

        return reply.send({
          success: true,
          data: { analysis: finalAnalysis },
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

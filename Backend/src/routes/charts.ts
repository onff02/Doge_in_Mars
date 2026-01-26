import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import yahooFinance from 'yahoo-finance2';

// 1. 라운드별 실제 역사적 경제 사건 시기 설정
const ROUND_PERIODS: Record<number, { start: string; end: string }> = {
  1: { start: '2008-09-01', end: '2009-03-31' }, // 리먼 브라더스 사태 (Bear Trap)
  2: { start: '2018-01-01', end: '2019-01-31' }, // 미중 무역전쟁 및 암호화폐 폭락
  3: { start: '2020-04-01', end: '2021-12-31' }, // 팬데믹 이후 불장 (Bull Run)
  4: { start: '2023-01-01', end: '2023-12-31' }, // AI 열풍 및 규제 이슈
  5: { start: '2022-01-01', end: '2022-10-31' }, // 금리 인상 및 거품 붕괴 (Bubble Burst)
  6: { start: '2024-01-01', end: '2026-01-26' }, // 현재 안착 구간
};

interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Yahoo Finance API를 통해 실기 주가 데이터를 가져옴
 */
async function getHistoricalChartData(symbol: string, round: number): Promise<ChartDataPoint[]> {
  const period = ROUND_PERIODS[round] || ROUND_PERIODS[6];
  
  try {
    const results = await yahooFinance.historical(symbol, {
      period1: period.start,
      period2: period.end,
      interval: '1d', // 일봉 데이터
    });
    
    return results.map(quote => ({
      timestamp: new Date(quote.date).getTime(),
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume,
    }));
  } catch (error) {
    console.error(`Yahoo Finance fetch error for ${symbol}:`, error);
    return [];
  }
}

/**
 * 게임용 중력파 데이터로 변환
 */
function transformToGravityData(chartData: ChartDataPoint[]) {
  const timestamps = chartData.map((d) => d.timestamp);
  const values = chartData.map((d) => d.close);
  
  // 안정도 계산 (전일 대비 변화율 %)
  const stability = chartData.map((d, i) => {
    if (i === 0) return 0;
    const prevClose = chartData[i - 1].close;
    return ((d.close - prevClose) / prevClose) * 100;
  });
  
  return { timestamps, values, stability };
}

export async function chartRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/charts
   * 라운드와 종목 심볼을 받아 실제 주가 기반 중력파 데이터 반환
   */
  fastify.get('/', async (request: FastifyRequest<{ 
    Querystring: { round?: string; symbol?: string };
  }>, reply: FastifyReply) => {
    try {
      const round = parseInt(request.query.round || '1', 10);
      const symbol = request.query.symbol || 'NVDA';
      const cacheKey = `CHART_${symbol}_R${round}`;
      
      // 1. 캐시 확인 (Prisma 이용)
      const cached = await prisma.chartDataCache.findUnique({
        where: { symbol: cacheKey },
      });
      
      let chartData: ChartDataPoint[];
      
      if (cached && new Date(cached.expiresAt) > new Date()) {
        chartData = cached.data as unknown as ChartDataPoint[];
      } else {
        // 2. 캐시 없거나 만료 시 Yahoo Finance에서 새로 가져옴
        chartData = await getHistoricalChartData(symbol, round);
        
        if (chartData.length === 0) {
          return reply.status(404).send({
            success: false,
            error: '데이터를 불러올 수 없습니다. 심볼이나 라운드를 확인하세요.',
          });
        }
        
        // 3. 캐시 저장 (데이터가 과거 기록이므로 24시간 동안 유효)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.chartDataCache.upsert({
          where: { symbol: cacheKey },
          update: {
            data: chartData as any,
            fetchedAt: new Date(),
            expiresAt,
          },
          create: {
            symbol: cacheKey,
            data: chartData as any,
            expiresAt,
          },
        });
      }
      
      const gravityData = transformToGravityData(chartData);
      
      return reply.send({
        success: true,
        data: {
          symbol,
          round,
          chartData, // 원본 OHLCV 데이터
          gravityData: {
            timestamps: gravityData.timestamps,
            values: gravityData.values,           // y축 주가
            stability: gravityData.stability,     // 중력파 안정도
          },
          meta: {
            dataPoints: chartData.length,
            startDate: ROUND_PERIODS[round]?.start,
            endDate: ROUND_PERIODS[round]?.end,
          }
        },
      });
    } catch (error) {
      console.error('Get chart error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });

  /**
   * GET /api/charts/live
   * 실시간 주가 데이터 (게임 플레이 중 업데이트용)
   */
  fastify.get('/live', async (request: FastifyRequest<{
    Querystring: { symbol?: string };
  }>, reply: FastifyReply) => {
    try {
      const symbol = request.query.symbol || 'NVDA';
      const quote = await yahooFinance.quote(symbol);
      
      return reply.send({
        success: true,
        data: {
          symbol: symbol,
          timestamp: Date.now(),
          price: quote.regularMarketPrice,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          isStable: (quote.regularMarketChangePercent || 0) >= -2, // 임의의 안정도 기준
        },
      });
    } catch (error) {
      console.error('Get live data error:', error);
      return reply.status(500).send({
        success: false,
        error: '실시간 데이터를 가져오는데 실패했습니다.',
      });
    }
  });
}
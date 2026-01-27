import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import yahooFinance from 'yahoo-finance2';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// 1. 라운드별 실제 역사적 경제 사건 시기 설정
const ROUND_PERIODS: Record<number, { start: string; end: string; trend: 'bull' | 'bear' | 'volatile' }> = {
  1: { start: '2008-01-01', end: '2008-08-31', trend: 'bear' },     // 리먼 브라더스 사태 (Bear Trap)
  2: { start: '2018-05-01', end: '2018-10-31', trend: 'volatile' }, // 미중 무역전쟁 및 암호화폐 폭락
  3: { start: '2020-01-01', end: '2020-03-20', trend: 'bull' },     // 팬데믹 이후 불장 (Bull Run)
  4: { start: '2022-06-01', end: '2022-12-31', trend: 'bull' },     // AI 열풍 및 규제 이슈
  5: { start: '2021-05-01', end: '2021-12-31', trend: 'bear' },     // 금리 인상 및 거품 붕괴 (Bubble Burst)
  6: { start: '2025-06-01', end: '2025-12-31', trend: 'volatile' }, // 현재 안착 구간
};

// 심볼별 기본 가격 설정
const SYMBOL_BASE_PRICES: Record<string, number> = {
  'NVDA': 150,
  'AAPL': 180,
  'KO': 60,
  'DOGE': 0.08,
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
 * 모의 차트 데이터 생성 (Yahoo Finance 실패 시 fallback)
 */
function generateMockChartData(symbol: string, round: number, points: number = 120): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const period = ROUND_PERIODS[round] || ROUND_PERIODS[1];
  const basePrice = SYMBOL_BASE_PRICES[symbol] || 100;
  
  let currentPrice = basePrice;
  const now = Date.now();
  const interval = 24 * 60 * 60 * 1000; // 1일 간격
  
  // 트렌드에 따른 변동성 설정
  const trendMultiplier = period.trend === 'bull' ? 0.015 : period.trend === 'bear' ? -0.01 : 0;
  const volatility = period.trend === 'volatile' ? 0.04 : 0.025;
  
  for (let i = 0; i < points; i++) {
    // 트렌드 + 랜덤 노이즈
    const trend = trendMultiplier;
    const noise = (Math.random() - 0.5) * volatility * 2;
    const change = 1 + trend + noise;
    
    currentPrice *= change;
    currentPrice = Math.max(currentPrice, basePrice * 0.3); // 최소 30%
    
    // OHLC 데이터 생성
    const volatilityFactor = currentPrice * 0.02;
    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const close = currentPrice;
    const high = Math.max(open, close) + Math.random() * volatilityFactor;
    const low = Math.min(open, close) - Math.random() * volatilityFactor;
    
    data.push({
      timestamp: now - (points - i) * interval,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.floor(Math.random() * 10000000) + 1000000,
    });
    
    currentPrice = close;
  }
  
  return data;
}

/**
 * Yahoo Finance API를 통해 실기 주가 데이터를 가져옴
 */
async function getHistoricalChartData(symbol: string, round: number): Promise<ChartDataPoint[]> {
  const period = ROUND_PERIODS[round] || ROUND_PERIODS[6];
  
  try {
    const results = await yahooFinance.chart(symbol, {
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
        
        // Yahoo Finance 실패 시 모의 데이터 사용 (fallback)
        if (chartData.length === 0) {
          console.log(`Yahoo Finance failed for ${symbol}, using mock data for round ${round}`);
          chartData = generateMockChartData(symbol, round, 120);
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
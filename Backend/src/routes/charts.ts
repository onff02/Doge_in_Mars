import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import YahooStockAPI from 'yahoo-stock-api';

const yahoo = new YahooStockAPI();

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
  
  // 1. 중복 선언 제거 및 변수명 정리 (now -> startDate)
  let currentPrice = basePrice;
  const startDate = new Date(period.start).getTime(); // 'now' 대신 'startDate'로 명명
  const interval = 24 * 60 * 60 * 1000; // 1일 간격
  
  // 2. 루프 시작 (중복된 'let currentPrice = basePrice;' 줄 삭제됨)
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * (basePrice * 0.05);
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    
    data.push({
      // 3. 위에서 정의한 startDate를 사용하여 타임스탬프 계산
      timestamp: startDate + (i * interval),
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
 * 2. Stooq CSV 파싱 로직 (Round 1 전용)
 */
async function getStooqHistoricalData(symbol: string, round: number): Promise<ChartDataPoint[]> {
  const period = ROUND_PERIODS[round];
  // Stooq은 미국 종목 뒤에 .US를 붙여야 하며, 날짜 형식이 YYYYMMDD여야 함
  const stooqSymbol = `${symbol}.US`;
  const d1 = period.start.replace(/-/g, '');
  const d2 = period.end.replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}&i=d&d1=${d1}&d2=${d2}`;

  try {
    const response = await fetch(url);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    
    if (lines.length <= 1) return []; // 헤더만 있거나 비어있는 경우

    const results: ChartDataPoint[] = [];
    // Date,Open,High,Low,Close,Volume 순서 파싱
    for (let i = 1; i < lines.length; i++) {
      const [dateStr, open, high, low, close, volume] = lines[i].split(',');
      const timestamp = new Date(dateStr).getTime();
      
      // 날짜 검증: 만약 2008년 데이터를 요청했는데 2025년 데이터가 섞여있다면 제외
      const year = new Date(timestamp).getFullYear();
      if (year > 2010 && round === 1) continue; 

      results.push({
        timestamp,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseInt(volume) || 0
      });
    }
    return results.sort((a, b) => a.timestamp - b.timestamp);
  } catch (e) {
    console.error("Stooq fetch error:", e);
    return [];
  }
}

/**
 * 3. 통합 데이터 로더
 */
async function getHistoricalChartData(symbol: string, round: number): Promise<ChartDataPoint[]> {
  // Round 1은 무조건 Stooq 시도
  if (round === 1) {
    const stooqData = await getStooqHistoricalData(symbol, round);
    if (stooqData.length > 0) return stooqData;
  }

  // 나머지 라운드 또는 Stooq 실패 시 yahoo-stock-api 시도
  const period = ROUND_PERIODS[round] || ROUND_PERIODS[1];
  try {
    const result = await yahoo.getHistoricalPrices({
      symbol,
      startDate: new Date(period.start),
      endDate: new Date(period.end),
      interval: '1d'
    });

    if (result && Array.isArray(result) && result.length > 0) {
      // 날짜 검증: API가 성공이라고 속이고 미래 날짜를 주는지 확인
      const firstYear = new Date(result[0].date * 1000).getFullYear();
      const expectedYear = new Date(period.start).getFullYear();
      
      if (Math.abs(firstYear - expectedYear) <= 1) {
        return result.map(item => ({
          timestamp: item.date * 1000,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume
        })).sort((a, b) => a.timestamp - b.timestamp);
      }
    }
  } catch (error) {
    console.error(`Yahoo fetch error for ${symbol}:`, error);
  }

  // 모든 API 실패 시 기간에 맞는 Mock 데이터 반환
  return generateMockChartData(symbol, round);
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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
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
      const end = new Date();
      const start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const hist = await (yahoo as any).getHistoricalPrices(symbol, formatDate(start), formatDate(end), '1d');

      if (!hist || !Array.isArray(hist) || hist.length === 0) {
        throw new Error('No live data');
      }

      const latest = hist[hist.length - 1];
      const prev = hist[hist.length - 2] || latest;
      const price = Number(latest.close ?? latest.Close ?? latest.adjClose ?? latest.AdjClose ?? 0);
      const prevPrice = Number(prev.close ?? prev.Close ?? prev.adjClose ?? prev.AdjClose ?? price);
      const change = price - prevPrice;
      const changePercent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;

      return reply.send({
        success: true,
        data: {
          symbol,
          timestamp: Date.now(),
          price,
          change,
          changePercent,
          isStable: changePercent >= -2, // 임의의 안정도 기준
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
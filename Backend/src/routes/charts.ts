import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';

// 모의 주식 데이터 생성 (실제로는 외부 API 연동 필요)
interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 고정 항로 설정 - Dogecoin to Mars!
const FIXED_ROUTE = {
  symbol: 'DOGE',
  basePrice: 0.08,
  volatility: 0.08,
  name: 'Dogecoin to Mars',
  description: '도지코인을 타고 화성으로! 변동성 높은 흥미진진한 항로입니다.',
};

/**
 * 모의 차트 데이터 생성
 * 실제 프로덕션에서는 Yahoo Finance, Alpha Vantage 등의 API를 사용
 */
function generateMockChartData(points: number = 100): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  
  let currentPrice = FIXED_ROUTE.basePrice;
  const now = Date.now();
  const interval = 60000; // 1분 간격
  
  for (let i = 0; i < points; i++) {
    // 랜덤 워크 + 약간의 트렌드
    const trend = Math.sin(i / 20) * FIXED_ROUTE.volatility * 0.5; // 사인파 트렌드
    const noise = (Math.random() - 0.5) * FIXED_ROUTE.volatility * 2;
    const change = 1 + trend + noise;
    
    currentPrice *= change;
    
    // OHLC 데이터 생성
    const volatilityFactor = FIXED_ROUTE.volatility * currentPrice;
    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const close = currentPrice;
    const high = Math.max(open, close) + Math.random() * volatilityFactor;
    const low = Math.min(open, close) - Math.random() * volatilityFactor;
    
    data.push({
      timestamp: now - (points - i) * interval,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume: Math.floor(Math.random() * 1000000) + 100000,
    });
    
    currentPrice = close;
  }
  
  return data;
}

/**
 * 중력파 데이터로 변환 (게임용)
 */
function transformToGravityData(chartData: ChartDataPoint[]): {
  timestamps: number[];
  values: number[];
  stability: number[];
} {
  const timestamps = chartData.map((d) => d.timestamp);
  const values = chartData.map((d) => d.close);
  
  // 안정도 계산 (전 봉 대비 변화율)
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
   * 고정 항로의 중력파 데이터 로드 (DOGE to Mars!)
   */
  fastify.get('/', async (request: FastifyRequest<{ 
    Querystring: { points?: string };
  }>, reply: FastifyReply) => {
    try {
      const points = parseInt(request.query.points || '100', 10);
      const symbol = FIXED_ROUTE.symbol;
      
      // 캐시 확인
      const cached = await prisma.chartDataCache.findUnique({
        where: { symbol },
      });
      
      let chartData: ChartDataPoint[];
      
      if (cached && new Date(cached.expiresAt) > new Date()) {
        // 캐시가 유효하면 사용
        chartData = cached.data as unknown as ChartDataPoint[];
      } else {
        // 새로운 데이터 생성 (실제로는 외부 API 호출)
        chartData = generateMockChartData(Math.min(points, 500));
        
        // 캐시 저장 (5분 TTL)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        
        await prisma.chartDataCache.upsert({
          where: { symbol },
          update: {
            data: chartData as any,
            fetchedAt: new Date(),
            expiresAt,
          },
          create: {
            symbol,
            data: chartData as any,
            expiresAt,
          },
        });
      }
      
      const gravityData = transformToGravityData(chartData);
      
      return reply.send({
        success: true,
        data: {
          symbol: FIXED_ROUTE.symbol,
          name: FIXED_ROUTE.name,
          description: FIXED_ROUTE.description,
          
          // 원본 차트 데이터 (OHLCV)
          chartData,
          
          // 게임용 중력파 데이터
          gravityData: {
            timestamps: gravityData.timestamps,
            values: gravityData.values,           // y축 값 (주가)
            stability: gravityData.stability,     // 중력파 안정도 (변화율 %)
          },
          
          // 메타데이터
          meta: {
            volatility: FIXED_ROUTE.volatility,
            currentPrice: chartData[chartData.length - 1]?.close,
            priceChange24h: calculatePriceChange(chartData),
            dataPoints: chartData.length,
            interval: '1m',
          },
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
   * 실시간 중력파 데이터 (단일 포인트) - 게임 플레이 중 실시간 업데이트용
   */
  fastify.get('/live', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const symbol = FIXED_ROUTE.symbol;
      
      // 실시간 데이터 시뮬레이션
      const cached = await prisma.chartDataCache.findUnique({
        where: { symbol },
      });
      
      let lastPrice = FIXED_ROUTE.basePrice;
      if (cached && Array.isArray(cached.data) && (cached.data as unknown as ChartDataPoint[]).length > 0) {
        const data = cached.data as unknown as ChartDataPoint[];
        lastPrice = data[data.length - 1].close;
      }
      
      // 새로운 가격 생성
      const change = (Math.random() - 0.5) * FIXED_ROUTE.volatility * 2;
      const newPrice = lastPrice * (1 + change);
      const changePercent = change * 100;
      
      return reply.send({
        success: true,
        data: {
          symbol: FIXED_ROUTE.symbol,
          timestamp: Date.now(),
          price: Number(newPrice.toFixed(4)),
          previousPrice: Number(lastPrice.toFixed(4)),
          change: Number((newPrice - lastPrice).toFixed(4)),
          changePercent: Number(changePercent.toFixed(2)),
          isStable: changePercent >= 0,
          stabilityLevel: Math.abs(changePercent),
        },
      });
    } catch (error) {
      console.error('Get live data error:', error);
      return reply.status(500).send({
        success: false,
        error: '서버 오류가 발생했습니다.',
      });
    }
  });
}

// 헬퍼 함수들

function calculatePriceChange(data: ChartDataPoint[]): number {
  if (data.length < 2) return 0;
  const first = data[0].close;
  const last = data[data.length - 1].close;
  return Number((((last - first) / first) * 100).toFixed(2));
}

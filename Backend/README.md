# Doge City in Mars - Backend

🚀 화성 갈끄니까 - 데이터 기반 항로 최적화 게임 백엔드

## 기술 스택

- **Runtime:** Node.js
- **Framework:** Fastify
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT
- **Validation:** Zod

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 설정하세요:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/doge_city_mars?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
PORT=3000
HOST="0.0.0.0"
```

### 3. 데이터베이스 설정

```bash
# Prisma 클라이언트 생성
npm run prisma:generate

# 데이터베이스 마이그레이션
npm run prisma:migrate

# (선택) 초기 데이터 시드
npm run prisma:seed
```

### 4. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## API 명세

### 인증 (Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 (토큰 발급) |
| GET | `/api/auth/me` | 내 정보 조회 |

### 항해 (Flight)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flight/status` | 내 항해 상태 조회 |
| POST | `/api/flight/reset` | 게임 초기화 |
| POST | `/api/flight/intro-complete` | 인트로 완료 처리 |
| POST | `/api/flight/start` | 항해 개시 |
| POST | `/api/flight/sync` | 실시간 항해 동기화 |
| POST | `/api/flight/ending` | 착륙 판정 요청 |
| GET | `/api/flight/logs/:sessionId` | 항해 로그 조회 |

### 로켓 (Rockets)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rockets` | 로켓 목록 조회 |
| GET | `/api/rockets/:id` | 로켓 상세 조회 |

### 차트 (Charts)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/charts` | 사용 가능한 항로 목록 |
| GET | `/api/charts/:symbol` | 중력파 데이터 로드 |
| GET | `/api/charts/:symbol/live` | 실시간 중력파 데이터 |

## 로켓 스탯 설명

| 스탯 | 기반 지표 | 설명 |
|------|----------|------|
| **가속 폭발력 (Boost)** | PER | 낮을수록 강력 - 상승장에서 거리 증가 |
| **선체 내구도 (Armor)** | PBR | 낮을수록 단단함 - 하락장에서 손상 감소 |
| **연비 효율 (Fuel Eco)** | ROE | 높을수록 알뜰함 - 연료 소모 감소 |

## 티어 시스템

| 티어 | 이름 | 조건 |
|------|------|------|
| S | 메가 도지 시티 | 연료 70%+, 선체 80%+ |
| A | 도지 정착촌 | 연료 50%+, 선체 60%+ |
| B | 도지 마을 | 연료 30%+, 선체 40%+ |
| C | 도지 텐트촌 | 연료 10%+, 선체 20%+ |
| D | 도지 텐트촌 | 간신히 도착 |
| F | 착륙 실패 | 화성 미도착 |

## 개발 도구

```bash
# Prisma Studio (DB GUI)
npm run prisma:studio

# API 문서
http://localhost:3000/docs
```

## 라이선스

ISC

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvestingStyle" AS ENUM ('AGGRESSIVE_GROWTH', 'BALANCED_INVESTOR', 'CAUTIOUS_VALUE', 'RISK_TAKER', 'DEFENSIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "introViewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rockets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "boostStat" DOUBLE PRECISION NOT NULL,
    "armorStat" DOUBLE PRECISION NOT NULL,
    "fuelEcoStat" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rockets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_sessions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "rocketId" INTEGER NOT NULL,
    "currentFuel" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "currentHull" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "distance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "symbol" TEXT NOT NULL DEFAULT 'AAPL',
    "totalFuelUsed" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "highStabilityThrustCount" INTEGER NOT NULL DEFAULT 0,
    "lowStabilityThrustCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "tier" TEXT,
    "investingStyle" "InvestingStyle",
    "advice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_logs" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "yValue" DOUBLE PRECISION NOT NULL,
    "fuelInput" DOUBLE PRECISION NOT NULL,
    "fuelAfter" DOUBLE PRECISION,
    "hullAfter" DOUBLE PRECISION,
    "distanceAfter" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_data_cache" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_data_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rockets_name_key" ON "rockets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "chart_data_cache_symbol_key" ON "chart_data_cache"("symbol");

-- AddForeignKey
ALTER TABLE "flight_sessions" ADD CONSTRAINT "flight_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_sessions" ADD CONSTRAINT "flight_sessions_rocketId_fkey" FOREIGN KEY ("rocketId") REFERENCES "rockets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_logs" ADD CONSTRAINT "flight_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "flight_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

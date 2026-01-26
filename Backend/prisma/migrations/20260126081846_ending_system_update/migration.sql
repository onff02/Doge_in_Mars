/*
  Warnings:

  - You are about to drop the column `armorStat` on the `rockets` table. All the data in the column will be lost.
  - You are about to drop the column `boostStat` on the `rockets` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `rockets` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `rockets` table. All the data in the column will be lost.
  - You are about to drop the column `fuelEcoStat` on the `rockets` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `rockets` table. All the data in the column will be lost.
  - Added the required column `armor` to the `rockets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `boost` to the `rockets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `rockets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fuelEco` to the `rockets` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TwistType" AS ENUM ('NONE', 'POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "GlobalEventType" AS ENUM ('BEAR_TRAP', 'BULL_RUN', 'BUBBLE_BURST', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('NEWS', 'PLAYING', 'RESULT');

-- CreateEnum
CREATE TYPE "FinalEnding" AS ENUM ('CRASH', 'MARS', 'INVASION');

-- AlterTable
ALTER TABLE "flight_logs" ADD COLUMN     "eventDescription" TEXT,
ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "isCorrectChoice" BOOLEAN,
ADD COLUMN     "isPositiveEvent" BOOLEAN,
ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "thrustMultiplier" DOUBLE PRECISION,
ADD COLUMN     "userChoseFuel" BOOLEAN,
ADD COLUMN     "wasRevealed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "flight_sessions" ADD COLUMN     "correctAnswers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentRound" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "finalEnding" "FinalEnding",
ADD COLUMN     "roundPhase" "RoundPhase" NOT NULL DEFAULT 'NEWS';

-- AlterTable
ALTER TABLE "rockets" DROP COLUMN "armorStat",
DROP COLUMN "boostStat",
DROP COLUMN "createdAt",
DROP COLUMN "description",
DROP COLUMN "fuelEcoStat",
DROP COLUMN "imageUrl",
ADD COLUMN     "armor" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "boost" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "fuelEco" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "game_events" (
    "id" SERIAL NOT NULL,
    "round" INTEGER NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "targetRocketId" INTEGER,
    "newsTitle" TEXT NOT NULL,
    "newsDetail" TEXT NOT NULL,
    "newsLog" TEXT NOT NULL,
    "thrustMod" DOUBLE PRECISION NOT NULL,
    "isTwist" BOOLEAN NOT NULL DEFAULT false,
    "twistType" "TwistType" NOT NULL DEFAULT 'NONE',
    "globalType" "GlobalEventType",
    "affectedStat" TEXT,
    "statMultiplier" DOUBLE PRECISION,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_targetRocketId_fkey" FOREIGN KEY ("targetRocketId") REFERENCES "rockets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

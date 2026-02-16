-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPPLIER', 'CONSUMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DIDStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EnergySource" AS ENUM ('SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'GEOTHERMAL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('MATCHED', 'CONFIRMED', 'SETTLED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TokenTxType" AS ENUM ('MINT', 'BURN', 'TRANSFER', 'LOCK', 'UNLOCK');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('EIA', 'ENTSOE', 'KPX');

-- CreateEnum
CREATE TYPE "PaymentCurrency" AS ENUM ('KRW', 'EPC');

-- CreateEnum
CREATE TYPE "RECTokenStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'RETIRED');

-- CreateEnum
CREATE TYPE "BlockchainTxType" AS ENUM ('DID', 'TRADE', 'SETTLEMENT', 'METERING', 'EPC_MINT', 'EPC_BURN', 'EPC_TRANSFER', 'EPC_PRICE', 'REC_TOKEN');

-- CreateEnum
CREATE TYPE "BlockchainTxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organization" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "did_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "status" "DIDStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "did_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "energy_source" "EnergySource" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "remaining_qty" DOUBLE PRECISION NOT NULL,
    "payment_currency" "PaymentCurrency" NOT NULL DEFAULT 'KRW',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "buy_order_id" TEXT NOT NULL,
    "sell_order_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "energy_source" "EnergySource" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "payment_currency" "PaymentCurrency" NOT NULL DEFAULT 'KRW',
    "status" "TradeStatus" NOT NULL DEFAULT 'MATCHED',
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "production" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consumption" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" "EnergySource" NOT NULL,
    "device_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_amount" DOUBLE PRECISION NOT NULL,
    "payment_currency" "PaymentCurrency" NOT NULL DEFAULT 'KRW',
    "epc_price" DOUBLE PRECISION,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "tx_hash" TEXT,
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_certificates" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "consumer_id" TEXT NOT NULL,
    "energy_source" "EnergySource" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "tx_hash" TEXT,

    CONSTRAINT "rec_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_balances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locked_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_transactions" (
    "id" TEXT NOT NULL,
    "type" "TokenTxType" NOT NULL,
    "from_id" TEXT,
    "to_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "ref_id" TEXT,
    "tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_oracle" (
    "id" TEXT NOT NULL,
    "source" "PriceSource" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "price_usd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "region" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_oracle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_baskets" (
    "id" TEXT NOT NULL,
    "weighted_avg_price" DOUBLE PRECISION NOT NULL,
    "eia_price" DOUBLE PRECISION,
    "eia_weight" DOUBLE PRECISION,
    "entsoe_price" DOUBLE PRECISION,
    "entsoe_weight" DOUBLE PRECISION,
    "kpx_price" DOUBLE PRECISION,
    "kpx_weight" DOUBLE PRECISION,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "tx_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_baskets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rec_tokens" (
    "id" TEXT NOT NULL,
    "cert_id" TEXT,
    "trade_id" TEXT,
    "issuer_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "energy_source" "EnergySource" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "vintage" TEXT NOT NULL,
    "location" TEXT,
    "status" "RECTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "retired_at" TIMESTAMP(3),
    "retired_by" TEXT,
    "tx_hash" TEXT,
    "metadata_hash" TEXT,

    CONSTRAINT "rec_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_transactions" (
    "id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "type" "BlockchainTxType" NOT NULL,
    "data" JSONB NOT NULL,
    "status" "BlockchainTxStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blockchain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "did_credentials_user_id_key" ON "did_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "did_credentials_did_key" ON "did_credentials"("did");

-- CreateIndex
CREATE INDEX "orders_type_status_energy_source_idx" ON "orders"("type", "status", "energy_source");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- CreateIndex
CREATE INDEX "trades_buyer_id_idx" ON "trades"("buyer_id");

-- CreateIndex
CREATE INDEX "trades_seller_id_idx" ON "trades"("seller_id");

-- CreateIndex
CREATE INDEX "meter_readings_user_id_timestamp_idx" ON "meter_readings"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "meter_readings_device_id_idx" ON "meter_readings"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_trade_id_key" ON "settlements"("trade_id");

-- CreateIndex
CREATE INDEX "settlements_status_idx" ON "settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rec_certificates_trade_id_key" ON "rec_certificates"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_balances_user_id_key" ON "token_balances"("user_id");

-- CreateIndex
CREATE INDEX "token_transactions_from_id_idx" ON "token_transactions"("from_id");

-- CreateIndex
CREATE INDEX "token_transactions_to_id_idx" ON "token_transactions"("to_id");

-- CreateIndex
CREATE INDEX "token_transactions_type_idx" ON "token_transactions"("type");

-- CreateIndex
CREATE INDEX "token_transactions_ref_id_idx" ON "token_transactions"("ref_id");

-- CreateIndex
CREATE INDEX "price_oracle_source_timestamp_idx" ON "price_oracle"("source", "timestamp");

-- CreateIndex
CREATE INDEX "price_baskets_timestamp_idx" ON "price_baskets"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "rec_tokens_cert_id_key" ON "rec_tokens"("cert_id");

-- CreateIndex
CREATE INDEX "rec_tokens_owner_id_status_idx" ON "rec_tokens"("owner_id", "status");

-- CreateIndex
CREATE INDEX "rec_tokens_issuer_id_idx" ON "rec_tokens"("issuer_id");

-- CreateIndex
CREATE INDEX "rec_tokens_status_idx" ON "rec_tokens"("status");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_transactions_tx_hash_key" ON "blockchain_transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "blockchain_transactions_type_status_idx" ON "blockchain_transactions"("type", "status");

-- AddForeignKey
ALTER TABLE "did_credentials" ADD CONSTRAINT "did_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buy_order_id_fkey" FOREIGN KEY ("buy_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_sell_order_id_fkey" FOREIGN KEY ("sell_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_certificates" ADD CONSTRAINT "rec_certificates_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_certificates" ADD CONSTRAINT "rec_certificates_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_certificates" ADD CONSTRAINT "rec_certificates_consumer_id_fkey" FOREIGN KEY ("consumer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_balances" ADD CONSTRAINT "token_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transactions" ADD CONSTRAINT "token_transactions_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_tokens" ADD CONSTRAINT "rec_tokens_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_tokens" ADD CONSTRAINT "rec_tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rec_tokens" ADD CONSTRAINT "rec_tokens_cert_id_fkey" FOREIGN KEY ("cert_id") REFERENCES "rec_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;


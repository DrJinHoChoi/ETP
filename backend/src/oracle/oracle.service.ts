import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { EIAProvider } from './providers/eia.provider';
import { ENTSOEProvider } from './providers/entsoe.provider';
import { KPXProvider } from './providers/kpx.provider';
import { PriceSource } from '@prisma/client';
import { v4 as uuid } from 'uuid';

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eiaProvider: EIAProvider,
    private readonly entsoeProvider: ENTSOEProvider,
    private readonly kpxProvider: KPXProvider,
    private readonly blockchainService: BlockchainService,
    private readonly eventsGateway: EventsGateway,
    private readonly configService: ConfigService,
  ) {}

  private getWeights() {
    return {
      eia: parseFloat(this.configService.get('ORACLE_WEIGHT_EIA', '0.40')),
      entsoe: parseFloat(
        this.configService.get('ORACLE_WEIGHT_ENTSOE', '0.35'),
      ),
      kpx: parseFloat(this.configService.get('ORACLE_WEIGHT_KPX', '0.25')),
    };
  }

  @Cron('*/15 * * * *')
  async fetchAndUpdatePrices() {
    this.logger.log('가격 오라클: 글로벌 전력 가격 수집 시작');

    const [eiaResult, entsoeResult, kpxResult] = await Promise.allSettled([
      this.eiaProvider.fetchPrice(),
      this.entsoeProvider.fetchPrice(),
      this.kpxProvider.fetchPrice(),
    ]);

    const eiaPrice =
      eiaResult.status === 'fulfilled' ? eiaResult.value : null;
    const entsoePrice =
      entsoeResult.status === 'fulfilled' ? entsoeResult.value : null;
    const kpxPrice =
      kpxResult.status === 'fulfilled' ? kpxResult.value : null;

    // 원본 데이터 저장
    const oracleRecords = [];
    if (eiaPrice) {
      oracleRecords.push(
        this.prisma.priceOracle.create({
          data: {
            source: PriceSource.EIA,
            price: eiaPrice.price,
            priceUsd: eiaPrice.priceUsd,
            currency: eiaPrice.currency,
            region: eiaPrice.region,
            timestamp: eiaPrice.timestamp,
          },
        }),
      );
    }
    if (entsoePrice) {
      oracleRecords.push(
        this.prisma.priceOracle.create({
          data: {
            source: PriceSource.ENTSOE,
            price: entsoePrice.price,
            priceUsd: entsoePrice.priceUsd,
            currency: entsoePrice.currency,
            region: entsoePrice.region,
            timestamp: entsoePrice.timestamp,
          },
        }),
      );
    }
    if (kpxPrice) {
      oracleRecords.push(
        this.prisma.priceOracle.create({
          data: {
            source: PriceSource.KPX,
            price: kpxPrice.price,
            priceUsd: kpxPrice.priceUsd,
            currency: kpxPrice.currency,
            region: kpxPrice.region,
            timestamp: kpxPrice.timestamp,
          },
        }),
      );
    }

    if (oracleRecords.length > 0) {
      await Promise.all(oracleRecords);
    }

    // 가중 평균 계산
    const basket = this.calculateBasketPrice(
      eiaPrice?.priceUsd ?? null,
      entsoePrice?.priceUsd ?? null,
      kpxPrice?.priceUsd ?? null,
    );

    const isStale = !eiaPrice && !entsoePrice && !kpxPrice;

    if (isStale) {
      this.logger.warn(
        '모든 가격 소스 수집 실패 - 최신 바스켓 가격을 유지합니다',
      );
      // 최신 가격 가져와서 stale 마킹
      const latest = await this.getLatestBasketPrice();
      if (latest) {
        await this.prisma.priceBasket.create({
          data: {
            weightedAvgPrice: latest.weightedAvgPrice,
            eiaPrice: latest.eiaPrice,
            eiaWeight: latest.eiaWeight,
            entsoePrice: latest.entsoePrice,
            entsoeWeight: latest.entsoeWeight,
            kpxPrice: latest.kpxPrice,
            kpxWeight: latest.kpxWeight,
            isStale: true,
            timestamp: new Date(),
          },
        });
      }
      return;
    }

    // 바스켓 저장
    const priceBasket = await this.prisma.priceBasket.create({
      data: {
        weightedAvgPrice: basket.weightedAvgPrice,
        eiaPrice: eiaPrice?.priceUsd ?? null,
        eiaWeight: basket.weights.eia,
        entsoePrice: entsoePrice?.priceUsd ?? null,
        entsoeWeight: basket.weights.entsoe,
        kpxPrice: kpxPrice?.priceUsd ?? null,
        kpxWeight: basket.weights.kpx,
        isStale: false,
        timestamp: new Date(),
      },
    });

    // 블록체인에 가격 기록
    try {
      const epcChaincode = this.configService.get(
        'FABRIC_CHAINCODE_EPC',
        'epc-cc',
      );
      const txHash = await this.blockchainService.submitTransaction(
        epcChaincode,
        'SetPrice',
        uuid(),
        'BASKET',
        basket.weightedAvgPrice.toString(),
        'USD',
        basket.weightedAvgPrice.toString(),
        new Date().toISOString(),
      );

      await this.prisma.priceBasket.update({
        where: { id: priceBasket.id },
        data: { txHash },
      });
    } catch (error) {
      this.logger.error(`블록체인 가격 기록 실패: ${error.message}`);
    }

    // WebSocket 브로드캐스트
    this.eventsGateway.emitPriceUpdate({
      weightedAvgPrice: basket.weightedAvgPrice,
      eiaPrice: eiaPrice?.priceUsd,
      entsoePrice: entsoePrice?.priceUsd,
      kpxPrice: kpxPrice?.priceUsd,
      isStale: false,
      timestamp: new Date(),
    });

    this.logger.log(
      `가격 바스켓 업데이트: ${basket.weightedAvgPrice.toFixed(5)} USD/kWh`,
    );

    return priceBasket;
  }

  async getLatestBasketPrice() {
    return this.prisma.priceBasket.findFirst({
      orderBy: { timestamp: 'desc' },
    });
  }

  async getPriceHistory(
    source?: PriceSource,
    from?: Date,
    to?: Date,
  ) {
    return this.prisma.priceOracle.findMany({
      where: {
        ...(source && { source }),
        ...(from || to
          ? {
              timestamp: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });
  }

  async getBasketHistory(from?: Date, to?: Date) {
    return this.prisma.priceBasket.findMany({
      where: {
        ...(from || to
          ? {
              timestamp: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });
  }

  private calculateBasketPrice(
    eiaPriceUsd: number | null,
    entsoePriceUsd: number | null,
    kpxPriceUsd: number | null,
  ) {
    const configWeights = this.getWeights();

    const sources: { price: number; weight: number; key: string }[] = [];

    if (eiaPriceUsd !== null) {
      sources.push({ price: eiaPriceUsd, weight: configWeights.eia, key: 'eia' });
    }
    if (entsoePriceUsd !== null) {
      sources.push({ price: entsoePriceUsd, weight: configWeights.entsoe, key: 'entsoe' });
    }
    if (kpxPriceUsd !== null) {
      sources.push({ price: kpxPriceUsd, weight: configWeights.kpx, key: 'kpx' });
    }

    // 가용 소스들로 재가중
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    const normalizedSources = sources.map((s) => ({
      ...s,
      weight: s.weight / totalWeight,
    }));

    const weightedAvgPrice = normalizedSources.reduce(
      (sum, s) => sum + s.price * s.weight,
      0,
    );

    const weights: Record<string, number | null> = {
      eia: null,
      entsoe: null,
      kpx: null,
    };
    normalizedSources.forEach((s) => {
      weights[s.key] = s.weight;
    });

    return {
      weightedAvgPrice: Math.round(weightedAvgPrice * 100000) / 100000,
      weights: {
        eia: weights.eia,
        entsoe: weights.entsoe,
        kpx: weights.kpx,
      },
    };
  }
}

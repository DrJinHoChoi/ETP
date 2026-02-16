import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PriceFetchResult } from './eia.provider';

@Injectable()
export class ENTSOEProvider {
  private readonly logger = new Logger(ENTSOEProvider.name);
  private readonly securityToken: string;
  private readonly baseUrl = 'https://web-api.tp.entsoe.eu/api';

  // EUR/USD 대략적 환율 (실제 서비스에서는 환율 API 연동 필요)
  private readonly eurToUsd = 1.08;

  constructor(private readonly configService: ConfigService) {
    this.securityToken = this.configService.get('ENTSOE_API_TOKEN', '');
  }

  async fetchPrice(): Promise<PriceFetchResult | null> {
    if (!this.securityToken) {
      this.logger.warn(
        'ENTSO-E API 토큰이 설정되지 않았습니다. 모의 데이터를 반환합니다.',
      );
      return this.getMockPrice();
    }

    try {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const formatDate = (d: Date) =>
        d.toISOString().replace(/[-:]/g, '').slice(0, 12) + '00';

      const response = await axios.get(this.baseUrl, {
        params: {
          securityToken: this.securityToken,
          documentType: 'A44', // Price Document
          in_Domain: '10Y1001A1001A82H', // DE (독일) BZN
          out_Domain: '10Y1001A1001A82H',
          periodStart: formatDate(periodStart),
          periodEnd: formatDate(now),
        },
        timeout: 15000,
      });

      // ENTSO-E는 XML 반환 - 간단 파싱
      const xml = response.data;
      const priceMatch = xml.match(
        /<price.amount>([\d.]+)<\/price.amount>/g,
      );
      if (!priceMatch || priceMatch.length === 0) {
        this.logger.warn('ENTSO-E 가격 데이터 파싱 실패');
        return this.getMockPrice();
      }

      const lastPrice = priceMatch[priceMatch.length - 1];
      const priceEurPerMwh = parseFloat(
        lastPrice.replace(/<\/?price.amount>/g, ''),
      );
      const priceUsdPerMwh = priceEurPerMwh * this.eurToUsd;
      const priceUsdPerKwh = priceUsdPerMwh / 1000;

      return {
        price: priceEurPerMwh,
        currency: 'EUR',
        region: 'EU-DE',
        timestamp: new Date(),
        priceUsd: Math.round(priceUsdPerKwh * 100000) / 100000,
      };
    } catch (error) {
      this.logger.error(`ENTSO-E 가격 수집 실패: ${error.message}`);
      return this.getMockPrice();
    }
  }

  private getMockPrice(): PriceFetchResult {
    // 유럽 평균 Day-ahead 가격: ~€50-80/MWh
    const basePricePerMwh = 55 + Math.random() * 25;
    const priceUsdPerMwh = basePricePerMwh * this.eurToUsd;
    return {
      price: Math.round(basePricePerMwh * 100) / 100,
      currency: 'EUR',
      region: 'EU-DE',
      timestamp: new Date(),
      priceUsd: Math.round((priceUsdPerMwh / 1000) * 100000) / 100000,
    };
  }
}

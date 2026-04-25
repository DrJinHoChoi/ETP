import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface PriceFetchResult {
  price: number;
  currency: string;
  region: string;
  timestamp: Date;
  priceUsd: number; // USD/kWh 정규화
}

@Injectable()
export class EIAProvider {
  private readonly logger = new Logger(EIAProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl =
    'https://api.eia.gov/v2/electricity/rto/wholesale-prices/data';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get('EIA_API_KEY', '');
  }

  async fetchPrice(): Promise<PriceFetchResult | null> {
    if (!this.apiKey) {
      this.logger.warn('EIA API 키가 설정되지 않았습니다. 모의 데이터를 반환합니다.');
      return this.getMockPrice();
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          api_key: this.apiKey,
          frequency: 'hourly',
          data: ['value'],
          sort: [{ column: 'period', direction: 'desc' }],
          length: 1,
        },
        timeout: 10000,
      });

      const data = response.data?.response?.data?.[0];
      if (!data) {
        this.logger.warn('EIA 응답 데이터가 없습니다');
        return this.getMockPrice();
      }

      const priceUsdPerMwh = parseFloat(data.value);
      const priceUsdPerKwh = priceUsdPerMwh / 1000;

      return {
        price: priceUsdPerMwh,
        currency: 'USD',
        region: data.respondent || 'US',
        timestamp: new Date(data.period),
        priceUsd: priceUsdPerKwh,
      };
    } catch (error) {
      this.logger.error(`EIA 가격 수집 실패: ${error.message}`);
      return this.getMockPrice();
    }
  }

  private getMockPrice(): PriceFetchResult {
    // 미국 평균 도매 전력가격: ~$40-60/MWh
    const basePricePerMwh = 45 + Math.random() * 15;
    return {
      price: Math.round(basePricePerMwh * 100) / 100,
      currency: 'USD',
      region: 'US-AVG',
      timestamp: new Date(),
      priceUsd: Math.round((basePricePerMwh / 1000) * 100000) / 100000,
    };
  }
}

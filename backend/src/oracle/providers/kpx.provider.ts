import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PriceFetchResult } from './eia.provider';

@Injectable()
export class KPXProvider {
  private readonly logger = new Logger(KPXProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  // KRW/USD 대략적 환율 (실제 서비스에서는 환율 API 연동 필요)
  private readonly krwToUsd = 1 / 1350;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get(
      'KPX_API_URL',
      'https://openapi.kpx.or.kr/openapi/smp/getSmp',
    );
    this.apiKey = this.configService.get('KPX_API_KEY', '');
  }

  async fetchPrice(): Promise<PriceFetchResult | null> {
    if (!this.apiKey) {
      this.logger.warn(
        'KPX API 키가 설정되지 않았습니다. 모의 데이터를 반환합니다.',
      );
      return this.getMockPrice();
    }

    try {
      const today = new Date();
      const dateStr = today
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');

      const response = await axios.get(this.apiUrl, {
        params: {
          ServiceKey: this.apiKey,
          areaCd: '1', // 육지
          tradeDt: dateStr,
        },
        timeout: 10000,
      });

      // KPX API 응답 파싱 (XML or JSON)
      const data = response.data;
      let smpPrice: number;

      if (typeof data === 'string') {
        // XML 응답 파싱
        const priceMatch = data.match(/<smp>([\d.]+)<\/smp>/);
        if (!priceMatch) {
          this.logger.warn('KPX SMP 가격 파싱 실패');
          return this.getMockPrice();
        }
        smpPrice = parseFloat(priceMatch[1]);
      } else if (data?.response?.body?.items?.item) {
        const items = Array.isArray(data.response.body.items.item)
          ? data.response.body.items.item
          : [data.response.body.items.item];
        smpPrice = parseFloat(items[items.length - 1].smp);
      } else {
        return this.getMockPrice();
      }

      // KPX SMP는 원/kWh 단위
      const priceUsdPerKwh = smpPrice * this.krwToUsd;

      return {
        price: smpPrice,
        currency: 'KRW',
        region: 'KR',
        timestamp: new Date(),
        priceUsd: Math.round(priceUsdPerKwh * 100000) / 100000,
      };
    } catch (error) {
      this.logger.error(`KPX 가격 수집 실패: ${error.message}`);
      return this.getMockPrice();
    }
  }

  private getMockPrice(): PriceFetchResult {
    // 한국 SMP 평균: ~100-150 원/kWh
    const priceKrwPerKwh = 110 + Math.random() * 40;
    const priceUsdPerKwh = priceKrwPerKwh * this.krwToUsd;
    return {
      price: Math.round(priceKrwPerKwh * 100) / 100,
      currency: 'KRW',
      region: 'KR',
      timestamp: new Date(),
      priceUsd: Math.round(priceUsdPerKwh * 100000) / 100000,
    };
  }
}

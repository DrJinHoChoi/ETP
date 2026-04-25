import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fabric Gateway 연결 관리 서비스
 *
 * Hyperledger Fabric 네트워크와의 연결을 관리하며,
 * 각 체인코드에 대한 contract 인스턴스를 제공한다.
 *
 * 참고: @hyperledger/fabric-gateway는 Fabric 네트워크가 실행 중일 때만 사용.
 * 개발 환경에서는 mock 모드로 동작할 수 있다.
 */
@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const fabricEnabled = this.configService.get<string>('FABRIC_ENABLED', 'false');
    if (fabricEnabled === 'true') {
      await this.connect();
    } else {
      this.logger.warn('Fabric 네트워크 연결 비활성화 (FABRIC_ENABLED=false)');
    }
  }

  async connect(): Promise<void> {
    try {
      // Fabric Gateway 연결 로직
      // 실제 Fabric 네트워크 구동 시 @hyperledger/fabric-gateway 사용
      this.logger.log('Fabric Gateway 연결 시도...');

      const peerEndpoint = this.configService.get<string>('FABRIC_PEER_ENDPOINT', 'localhost:7051');
      const mspId = this.configService.get<string>('FABRIC_MSP_ID', 'AdminOrgMSP');

      this.logger.log(`Peer: ${peerEndpoint}, MSP: ${mspId}`);

      // TODO: 실제 연결 구현
      // const client = new grpc.Client(peerEndpoint, grpc.credentials.createInsecure());
      // const gateway = connect({ client, identity, signer, ... });

      this.connected = true;
      this.logger.log('Fabric Gateway 연결 성공');
    } catch (error) {
      this.logger.error('Fabric Gateway 연결 실패', error);
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getChannelName(): string {
    return this.configService.get<string>('FABRIC_CHANNEL_NAME', 'trading-channel');
  }

  /**
   * 체인코드 호출 (Transaction Submit)
   * Fabric 네트워크가 비활성화 상태이면 mock 결과 반환
   */
  async submitTransaction(
    chaincodeName: string,
    functionName: string,
    ...args: string[]
  ): Promise<string> {
    if (!this.connected) {
      this.logger.warn(
        `[MOCK] submitTransaction: ${chaincodeName}.${functionName}(${args.join(', ')})`,
      );
      return JSON.stringify({
        mock: true,
        chaincode: chaincodeName,
        function: functionName,
        args,
        txId: `mock-tx-${Date.now()}`,
      });
    }

    // TODO: 실제 Fabric Gateway를 통한 트랜잭션 제출
    // const network = gateway.getNetwork(this.getChannelName());
    // const contract = network.getContract(chaincodeName);
    // const result = await contract.submitTransaction(functionName, ...args);
    // return Buffer.from(result).toString('utf8');

    throw new Error('Fabric 트랜잭션 제출 미구현');
  }

  /**
   * 체인코드 조회 (Evaluate Transaction)
   */
  async evaluateTransaction(
    chaincodeName: string,
    functionName: string,
    ...args: string[]
  ): Promise<string> {
    if (!this.connected) {
      this.logger.warn(
        `[MOCK] evaluateTransaction: ${chaincodeName}.${functionName}(${args.join(', ')})`,
      );
      return JSON.stringify({
        mock: true,
        chaincode: chaincodeName,
        function: functionName,
        args,
      });
    }

    // TODO: 실제 Fabric Gateway를 통한 쿼리
    throw new Error('Fabric 트랜잭션 평가 미구현');
  }
}

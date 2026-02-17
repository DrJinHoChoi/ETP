import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class DIDBlockchainService {
  private readonly logger = new Logger(DIDBlockchainService.name);
  private readonly chaincodeName: string;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {
    this.chaincodeName = this.configService.get<string>(
      'FABRIC_CHAINCODE_DID',
      'did-cc',
    );
  }

  /**
   * DID 생성 및 블록체인 등록
   */
  async createDID(
    userId: string,
    role: string,
    organization: string,
  ): Promise<{ did: string; publicKey: string }> {
    // Ed25519 키 쌍 생성
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyHex = publicKey
      .export({ type: 'spki', format: 'der' })
      .toString('hex');

    // DID 식별자 생성
    const did = `did:etp:${uuidv4()}`;

    // 블록체인에 DID 등록
    await this.blockchainService.submitTransaction(
      this.chaincodeName,
      'CreateDID',
      did,
      userId,
      publicKeyHex,
      role,
      organization,
    );

    this.logger.log(`DID 생성 완료: ${did} (user: ${userId})`);

    // privateKey는 서버에서만 사용하며 클라이언트에 반환하지 않음
    return { did, publicKey: publicKeyHex };
  }

  /**
   * DID 검증
   */
  async verifyDID(
    did: string,
    publicKey: string,
  ): Promise<{ valid: boolean; message: string }> {
    const result = await this.blockchainService.evaluateTransaction(
      this.chaincodeName,
      'VerifyDID',
      did,
      publicKey,
    );

    return JSON.parse(result);
  }

  /**
   * DID 조회
   */
  async getDID(did: string) {
    const result = await this.blockchainService.evaluateTransaction(
      this.chaincodeName,
      'GetDID',
      did,
    );

    return JSON.parse(result);
  }

  /**
   * 사용자 ID로 DID 조회
   */
  async getDIDByUserId(userId: string) {
    const result = await this.blockchainService.evaluateTransaction(
      this.chaincodeName,
      'GetDIDByUserID',
      userId,
    );

    return JSON.parse(result);
  }

  /**
   * DID 폐기
   */
  async revokeDID(did: string): Promise<void> {
    await this.blockchainService.submitTransaction(
      this.chaincodeName,
      'RevokeDID',
      did,
    );

    this.logger.log(`DID 폐기 완료: ${did}`);
  }
}

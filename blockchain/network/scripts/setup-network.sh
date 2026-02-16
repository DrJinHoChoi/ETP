#!/bin/bash
# ETP Hyperledger Fabric 네트워크 설정 스크립트

set -e

CHANNEL_NAME="trading-channel"
CHAINCODE_DID="did-cc"
CHAINCODE_TRADING="trading-cc"
CHAINCODE_SETTLEMENT="settlement-cc"
CHAINCODE_METERING="metering-cc"

echo "=========================================="
echo "  ETP Fabric Network Setup"
echo "=========================================="

# 1. 암호화 자료 생성
echo ">> 1. Generating crypto materials..."
cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

# 2. 채널 아티팩트 생성
echo ">> 2. Generating channel artifacts..."
mkdir -p channel-artifacts

configtxgen -profile ETPOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block
configtxgen -profile TradingChannel -outputCreateChannelTx ./channel-artifacts/${CHANNEL_NAME}.tx -channelID ${CHANNEL_NAME}

# 앵커 피어 트랜잭션 생성
configtxgen -profile TradingChannel -outputAnchorPeersUpdate ./channel-artifacts/SupplierOrgMSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg SupplierOrg
configtxgen -profile TradingChannel -outputAnchorPeersUpdate ./channel-artifacts/ConsumerOrgMSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg ConsumerOrg
configtxgen -profile TradingChannel -outputAnchorPeersUpdate ./channel-artifacts/AdminOrgMSPanchors.tx -channelID ${CHANNEL_NAME} -asOrg AdminOrg

# 3. 네트워크 시작
echo ">> 3. Starting network..."
docker compose -f docker-compose.yaml up -d

echo ">> Waiting for network to start..."
sleep 10

# 4. 채널 생성 및 조인
echo ">> 4. Creating channel: ${CHANNEL_NAME}"
docker exec etp-cli peer channel create \
  -o orderer.etp.com:7050 \
  -c ${CHANNEL_NAME} \
  -f ./channel-artifacts/${CHANNEL_NAME}.tx \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/etp.com/orderers/orderer.etp.com/msp/tlscacerts/tlsca.etp.com-cert.pem

echo ">> Joining SupplierOrg peers..."
docker exec etp-cli peer channel join -b ${CHANNEL_NAME}.block

echo ">> Joining ConsumerOrg peers..."
docker exec -e CORE_PEER_LOCALMSPID=ConsumerOrgMSP \
  -e CORE_PEER_ADDRESS=peer0.consumer.etp.com:9051 \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/consumer.etp.com/peers/peer0.consumer.etp.com/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/consumer.etp.com/users/Admin@consumer.etp.com/msp \
  etp-cli peer channel join -b ${CHANNEL_NAME}.block

echo ">> Joining AdminOrg peers..."
docker exec -e CORE_PEER_LOCALMSPID=AdminOrgMSP \
  -e CORE_PEER_ADDRESS=peer0.admin.etp.com:11051 \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/admin.etp.com/peers/peer0.admin.etp.com/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/admin.etp.com/users/Admin@admin.etp.com/msp \
  etp-cli peer channel join -b ${CHANNEL_NAME}.block

echo "=========================================="
echo "  Network setup complete!"
echo "  Channel: ${CHANNEL_NAME}"
echo "  Orgs: SupplierOrg, ConsumerOrg, AdminOrg"
echo "=========================================="

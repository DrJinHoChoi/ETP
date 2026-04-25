package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// RECTokenContract - REC NFT 토큰 스마트 컨트랙트
type RECTokenContract struct {
	contractapi.Contract
}

// RECToken - 비대체성 REC 토큰
type RECToken struct {
	TokenID      string  `json:"tokenId"`
	CertID       string  `json:"certId"`
	TradeID      string  `json:"tradeId"`
	IssuerID     string  `json:"issuerId"`
	OwnerID      string  `json:"ownerId"`
	EnergySource string  `json:"energySource"`
	Quantity     float64 `json:"quantity"`
	Vintage      string  `json:"vintage"`
	Location     string  `json:"location"`
	Status       string  `json:"status"` // ACTIVE, TRANSFERRED, RETIRED
	IssuedAt     string  `json:"issuedAt"`
	ValidUntil   string  `json:"validUntil"`
	RetiredAt    string  `json:"retiredAt"`
	RetiredBy    string  `json:"retiredBy"`
	MetadataHash string  `json:"metadataHash"`
}

// RECTransferRecord - REC 양도 기록
type RECTransferRecord struct {
	TransferID string `json:"transferId"`
	TokenID    string `json:"tokenId"`
	FromID     string `json:"fromId"`
	ToID       string `json:"toId"`
	Timestamp  string `json:"timestamp"`
}

// InitLedger - REC 토큰 원장 초기화
func (c *RECTokenContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	return ctx.GetStub().PutState("REC_TOKEN_COUNTER", []byte("0"))
}

// IssueREC - REC 토큰 발행
func (c *RECTokenContract) IssueREC(ctx contractapi.TransactionContextInterface, tokenID string, certID string, tradeID string, issuerID string, ownerID string, energySource string, quantity float64, vintage string, location string, validUntil string, metadataHash string) error {
	// 중복 확인
	existing, err := ctx.GetStub().GetState("RECT_" + tokenID)
	if err != nil {
		return fmt.Errorf("REC 토큰 조회 실패: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("REC 토큰이 이미 존재합니다: %s", tokenID)
	}

	token := RECToken{
		TokenID:      tokenID,
		CertID:       certID,
		TradeID:      tradeID,
		IssuerID:     issuerID,
		OwnerID:      ownerID,
		EnergySource: energySource,
		Quantity:     quantity,
		Vintage:      vintage,
		Location:     location,
		Status:       "ACTIVE",
		IssuedAt:     time.Now().UTC().Format(time.RFC3339),
		ValidUntil:   validUntil,
		MetadataHash: metadataHash,
	}

	tokenJSON, err := json.Marshal(token)
	if err != nil {
		return fmt.Errorf("REC 토큰 직렬화 실패: %v", err)
	}

	// 토큰 저장
	if err := ctx.GetStub().PutState("RECT_"+tokenID, tokenJSON); err != nil {
		return fmt.Errorf("REC 토큰 저장 실패: %v", err)
	}

	// 소유권 인덱스 저장
	if err := ctx.GetStub().PutState("RECT_OWNER_"+ownerID+"_"+tokenID, []byte(tokenID)); err != nil {
		return fmt.Errorf("소유권 인덱스 저장 실패: %v", err)
	}

	ctx.GetStub().SetEvent("RECIssuedEvent", tokenJSON)

	return nil
}

// TransferREC - REC 토큰 양도
func (c *RECTokenContract) TransferREC(ctx contractapi.TransactionContextInterface, tokenID string, fromID string, toID string) error {
	token, err := c.getToken(ctx, tokenID)
	if err != nil {
		return err
	}

	if token.OwnerID != fromID {
		return fmt.Errorf("소유자가 아닙니다: 현재 소유자 %s, 요청자 %s", token.OwnerID, fromID)
	}

	if token.Status != "ACTIVE" {
		return fmt.Errorf("이전 가능한 상태가 아닙니다: 현재 상태 %s", token.Status)
	}

	// 기존 소유권 인덱스 삭제
	ctx.GetStub().DelState("RECT_OWNER_" + fromID + "_" + tokenID)

	// 소유권 변경
	token.OwnerID = toID
	token.Status = "ACTIVE"

	tokenJSON, err := json.Marshal(token)
	if err != nil {
		return fmt.Errorf("REC 토큰 직렬화 실패: %v", err)
	}

	if err := ctx.GetStub().PutState("RECT_"+tokenID, tokenJSON); err != nil {
		return fmt.Errorf("REC 토큰 업데이트 실패: %v", err)
	}

	// 새 소유권 인덱스 저장
	if err := ctx.GetStub().PutState("RECT_OWNER_"+toID+"_"+tokenID, []byte(tokenID)); err != nil {
		return fmt.Errorf("소유권 인덱스 저장 실패: %v", err)
	}

	// 양도 기록 저장
	transferID := ctx.GetStub().GetTxID()
	transferRecord := RECTransferRecord{
		TransferID: transferID,
		TokenID:    tokenID,
		FromID:     fromID,
		ToID:       toID,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	transferJSON, _ := json.Marshal(transferRecord)
	ctx.GetStub().PutState("RECT_TXF_"+transferID, transferJSON)
	ctx.GetStub().SetEvent("RECTransferEvent", transferJSON)

	return nil
}

// RetireREC - REC 토큰 소멸 (RE100 달성 처리)
func (c *RECTokenContract) RetireREC(ctx contractapi.TransactionContextInterface, tokenID string, retiredBy string) error {
	token, err := c.getToken(ctx, tokenID)
	if err != nil {
		return err
	}

	if token.OwnerID != retiredBy {
		return fmt.Errorf("소유자만 소멸할 수 있습니다")
	}

	if token.Status == "RETIRED" {
		return fmt.Errorf("이미 소멸된 REC 토큰입니다")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	token.Status = "RETIRED"
	token.RetiredAt = now
	token.RetiredBy = retiredBy

	tokenJSON, err := json.Marshal(token)
	if err != nil {
		return fmt.Errorf("REC 토큰 직렬화 실패: %v", err)
	}

	if err := ctx.GetStub().PutState("RECT_"+tokenID, tokenJSON); err != nil {
		return fmt.Errorf("REC 토큰 업데이트 실패: %v", err)
	}

	ctx.GetStub().SetEvent("RECRetiredEvent", tokenJSON)

	return nil
}

// GetREC - REC 토큰 조회
func (c *RECTokenContract) GetREC(ctx contractapi.TransactionContextInterface, tokenID string) (*RECToken, error) {
	return c.getToken(ctx, tokenID)
}

// GetRECsByOwner - 소유자별 REC 토큰 조회
func (c *RECTokenContract) GetRECsByOwner(ctx contractapi.TransactionContextInterface, ownerID string) ([]RECToken, error) {
	startKey := "RECT_OWNER_" + ownerID + "_"
	endKey := "RECT_OWNER_" + ownerID + "_~"

	resultsIter, err := ctx.GetStub().GetStateByRange(startKey, endKey)
	if err != nil {
		return nil, fmt.Errorf("소유자 토큰 조회 실패: %v", err)
	}
	defer resultsIter.Close()

	var tokens []RECToken
	for resultsIter.HasNext() {
		result, err := resultsIter.Next()
		if err != nil {
			return nil, fmt.Errorf("순회 실패: %v", err)
		}

		tokenID := string(result.Value)
		token, err := c.getToken(ctx, tokenID)
		if err != nil {
			continue
		}
		tokens = append(tokens, *token)
	}

	return tokens, nil
}

// GetRECHistory - REC 토큰 이력 (provenance chain)
func (c *RECTokenContract) GetRECHistory(ctx contractapi.TransactionContextInterface, tokenID string) ([]RECToken, error) {
	historyIter, err := ctx.GetStub().GetHistoryForKey("RECT_" + tokenID)
	if err != nil {
		return nil, fmt.Errorf("REC 이력 조회 실패: %v", err)
	}
	defer historyIter.Close()

	var history []RECToken
	for historyIter.HasNext() {
		result, err := historyIter.Next()
		if err != nil {
			return nil, fmt.Errorf("이력 순회 실패: %v", err)
		}

		var token RECToken
		if err := json.Unmarshal(result.Value, &token); err != nil {
			continue
		}
		history = append(history, token)
	}

	return history, nil
}

// ========== 내부 헬퍼 ==========

func (c *RECTokenContract) getToken(ctx contractapi.TransactionContextInterface, tokenID string) (*RECToken, error) {
	tokenJSON, err := ctx.GetStub().GetState("RECT_" + tokenID)
	if err != nil {
		return nil, fmt.Errorf("REC 토큰 조회 실패: %v", err)
	}
	if tokenJSON == nil {
		return nil, fmt.Errorf("REC 토큰을 찾을 수 없습니다: %s", tokenID)
	}

	var token RECToken
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		return nil, fmt.Errorf("REC 토큰 역직렬화 실패: %v", err)
	}

	return &token, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&RECTokenContract{})
	if err != nil {
		log.Panicf("REC 토큰 체인코드 생성 실패: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("REC 토큰 체인코드 시작 실패: %v", err)
	}
}

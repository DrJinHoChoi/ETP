package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SettlementContract - 정산 스마트 컨트랙트
type SettlementContract struct {
	contractapi.Contract
}

// SettlementRecord - 정산 기록
type SettlementRecord struct {
	SettlementID string  `json:"settlementId"`
	TradeID      string  `json:"tradeId"`
	BuyerID      string  `json:"buyerId"`
	SellerID     string  `json:"sellerId"`
	Amount       float64 `json:"amount"`
	Fee          float64 `json:"fee"`
	NetAmount    float64 `json:"netAmount"`
	Status       string  `json:"status"` // PENDING, PROCESSING, COMPLETED, FAILED
	CreatedAt    string  `json:"createdAt"`
	SettledAt    string  `json:"settledAt"`
}

// CreateSettlement - 정산 기록 생성
func (c *SettlementContract) CreateSettlement(ctx contractapi.TransactionContextInterface, settlementID string, tradeID string, buyerID string, sellerID string, amount float64, fee float64) error {
	now := time.Now().UTC().Format(time.RFC3339)

	record := SettlementRecord{
		SettlementID: settlementID,
		TradeID:      tradeID,
		BuyerID:      buyerID,
		SellerID:     sellerID,
		Amount:       amount,
		Fee:          fee,
		NetAmount:    amount - fee,
		Status:       "PENDING",
		CreatedAt:    now,
		SettledAt:    "",
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("정산 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(settlementID, recordJSON)
}

// GetSettlement - 정산 기록 조회
func (c *SettlementContract) GetSettlement(ctx contractapi.TransactionContextInterface, settlementID string) (*SettlementRecord, error) {
	recordJSON, err := ctx.GetStub().GetState(settlementID)
	if err != nil {
		return nil, fmt.Errorf("정산 조회 실패: %v", err)
	}
	if recordJSON == nil {
		return nil, fmt.Errorf("정산을 찾을 수 없습니다: %s", settlementID)
	}

	var record SettlementRecord
	if err := json.Unmarshal(recordJSON, &record); err != nil {
		return nil, fmt.Errorf("정산 역직렬화 실패: %v", err)
	}

	return &record, nil
}

// ConfirmPayment - 정산 완료 처리
func (c *SettlementContract) ConfirmPayment(ctx contractapi.TransactionContextInterface, settlementID string) error {
	record, err := c.GetSettlement(ctx, settlementID)
	if err != nil {
		return err
	}

	record.Status = "COMPLETED"
	record.SettledAt = time.Now().UTC().Format(time.RFC3339)

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("정산 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(settlementID, recordJSON)
}

// FailSettlement - 정산 실패 처리
func (c *SettlementContract) FailSettlement(ctx contractapi.TransactionContextInterface, settlementID string) error {
	record, err := c.GetSettlement(ctx, settlementID)
	if err != nil {
		return err
	}

	record.Status = "FAILED"

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("정산 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(settlementID, recordJSON)
}

func main() {
	chaincode, err := contractapi.NewChaincode(&SettlementContract{})
	if err != nil {
		fmt.Printf("체인코드 생성 실패: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("체인코드 시작 실패: %v\n", err)
	}
}

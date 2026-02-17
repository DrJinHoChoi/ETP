package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// TradingContract - 전력 거래 스마트 컨트랙트
type TradingContract struct {
	contractapi.Contract
}

// TradeRecord - 블록체인에 기록되는 거래 데이터
type TradeRecord struct {
	TradeID      string  `json:"tradeId"`
	BuyOrderID   string  `json:"buyOrderId"`
	SellOrderID  string  `json:"sellOrderId"`
	BuyerID      string  `json:"buyerId"`
	SellerID     string  `json:"sellerId"`
	EnergySource string  `json:"energySource"`
	Quantity     float64 `json:"quantity"`
	Price        float64 `json:"price"`
	TotalAmount  float64 `json:"totalAmount"`
	Status       string  `json:"status"` // MATCHED, CONFIRMED, SETTLED, CANCELLED
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

// RECCertRecord - REC 인증서 블록체인 기록
type RECCertRecord struct {
	CertID       string  `json:"certId"`
	TradeID      string  `json:"tradeId"`
	SupplierID   string  `json:"supplierId"`
	ConsumerID   string  `json:"consumererId"`
	EnergySource string  `json:"energySource"`
	Quantity     float64 `json:"quantity"`
	IssuedAt     string  `json:"issuedAt"`
	ValidUntil   string  `json:"validUntil"`
	Status       string  `json:"status"`
}

// CreateTrade - 거래 기록 생성
func (c *TradingContract) CreateTrade(ctx contractapi.TransactionContextInterface, tradeID string, buyOrderID string, sellOrderID string, buyerID string, sellerID string, energySource string, quantity float64, price float64) error {
	existing, err := ctx.GetStub().GetState(tradeID)
	if err != nil {
		return fmt.Errorf("거래 조회 실패: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("거래가 이미 존재합니다: %s", tradeID)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	record := TradeRecord{
		TradeID:      tradeID,
		BuyOrderID:   buyOrderID,
		SellOrderID:  sellOrderID,
		BuyerID:      buyerID,
		SellerID:     sellerID,
		EnergySource: energySource,
		Quantity:     quantity,
		Price:        price,
		TotalAmount:  quantity * price,
		Status:       "MATCHED",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("거래 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(tradeID, recordJSON)
}

// GetTrade - 거래 기록 조회
func (c *TradingContract) GetTrade(ctx contractapi.TransactionContextInterface, tradeID string) (*TradeRecord, error) {
	recordJSON, err := ctx.GetStub().GetState(tradeID)
	if err != nil {
		return nil, fmt.Errorf("거래 조회 실패: %v", err)
	}
	if recordJSON == nil {
		return nil, fmt.Errorf("거래를 찾을 수 없습니다: %s", tradeID)
	}

	var record TradeRecord
	if err := json.Unmarshal(recordJSON, &record); err != nil {
		return nil, fmt.Errorf("거래 역직렬화 실패: %v", err)
	}

	return &record, nil
}

// UpdateTradeStatus - 거래 상태 변경
func (c *TradingContract) UpdateTradeStatus(ctx contractapi.TransactionContextInterface, tradeID string, newStatus string) error {
	record, err := c.GetTrade(ctx, tradeID)
	if err != nil {
		return err
	}

	record.Status = newStatus
	record.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("거래 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(tradeID, recordJSON)
}

// IssueREC - REC 인증서 발급
func (c *TradingContract) IssueREC(ctx contractapi.TransactionContextInterface, certID string, tradeID string, supplierID string, consumerID string, energySource string, quantity float64, validUntil string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	cert := RECCertRecord{
		CertID:       certID,
		TradeID:      tradeID,
		SupplierID:   supplierID,
		ConsumerID:   consumerID,
		EnergySource: energySource,
		Quantity:     quantity,
		IssuedAt:     now,
		ValidUntil:   validUntil,
		Status:       "VALID",
	}

	certJSON, err := json.Marshal(cert)
	if err != nil {
		return fmt.Errorf("REC 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState("REC_"+certID, certJSON)
}

// GetTradeHistory - 거래 이력 조회 (키 범위 조회)
func (c *TradingContract) GetTradeHistory(ctx contractapi.TransactionContextInterface, tradeID string) ([]TradeRecord, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(tradeID)
	if err != nil {
		return nil, fmt.Errorf("거래 이력 조회 실패: %v", err)
	}
	defer historyIterator.Close()

	var records []TradeRecord
	for historyIterator.HasNext() {
		modification, err := historyIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("이력 반복 실패: %v", err)
		}

		var record TradeRecord
		if err := json.Unmarshal(modification.Value, &record); err != nil {
			continue
		}
		records = append(records, record)
	}

	return records, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&TradingContract{})
	if err != nil {
		fmt.Printf("체인코드 생성 실패: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("체인코드 시작 실패: %v\n", err)
	}
}

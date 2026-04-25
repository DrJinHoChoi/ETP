package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EPCContract - EPC 스테이블코인 스마트 컨트랙트
type EPCContract struct {
	contractapi.Contract
}

// TokenBalance - 사용자 토큰 잔액
type TokenBalance struct {
	UserID        string  `json:"userId"`
	Balance       float64 `json:"balance"`
	LockedBalance float64 `json:"lockedBalance"`
	UpdatedAt     string  `json:"updatedAt"`
}

// TokenTransaction - 토큰 거래 기록
type TokenTransaction struct {
	TxID      string  `json:"txId"`
	Type      string  `json:"type"` // MINT, BURN, TRANSFER, LOCK, UNLOCK
	From      string  `json:"from"`
	To        string  `json:"to"`
	Amount    float64 `json:"amount"`
	Reason    string  `json:"reason"`
	RefID     string  `json:"refId"`
	CreatedAt string  `json:"createdAt"`
}

// PriceRecord - 전력 가격 기록 (오라클 데이터)
type PriceRecord struct {
	PriceID     string  `json:"priceId"`
	Source      string  `json:"source"` // EIA, ENTSOE, KPX
	Price       float64 `json:"price"`
	Currency    string  `json:"currency"`
	BasketPrice float64 `json:"basketPrice"`
	Timestamp   string  `json:"timestamp"`
	RecordedAt  string  `json:"recordedAt"`
}

// TokenSupply - 전체 공급량 메타데이터
type TokenSupply struct {
	TotalSupply  float64 `json:"totalSupply"`
	TotalMinted  float64 `json:"totalMinted"`
	TotalBurned  float64 `json:"totalBurned"`
	CurrentPrice float64 `json:"currentPrice"`
	UpdatedAt    string  `json:"updatedAt"`
}

// InitLedger - 토큰 원장 초기화
func (c *EPCContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	supply := TokenSupply{
		TotalSupply:  0,
		TotalMinted:  0,
		TotalBurned:  0,
		CurrentPrice: 0,
		UpdatedAt:    time.Now().UTC().Format(time.RFC3339),
	}

	supplyJSON, err := json.Marshal(supply)
	if err != nil {
		return fmt.Errorf("EPC 공급량 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState("EPC_SUPPLY", supplyJSON)
}

// SetPrice - 글로벌 전력 가격 업데이트 (관리자 전용)
func (c *EPCContract) SetPrice(ctx contractapi.TransactionContextInterface, priceID string, source string, price float64, currency string, basketPrice float64, timestamp string) error {
	if price <= 0 {
		return fmt.Errorf("가격은 0보다 커야 합니다")
	}
	if basketPrice <= 0 {
		return fmt.Errorf("바스켓 가격은 0보다 커야 합니다")
	}

	record := PriceRecord{
		PriceID:     priceID,
		Source:      source,
		Price:       price,
		Currency:    currency,
		BasketPrice: basketPrice,
		Timestamp:   timestamp,
		RecordedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("가격 기록 직렬화 실패: %v", err)
	}

	// 가격 기록 저장
	if err := ctx.GetStub().PutState("PRICE_"+priceID, recordJSON); err != nil {
		return fmt.Errorf("가격 기록 저장 실패: %v", err)
	}

	// 최신 가격 포인터 업데이트
	if err := ctx.GetStub().PutState("EPC_LATEST_PRICE", recordJSON); err != nil {
		return fmt.Errorf("최신 가격 업데이트 실패: %v", err)
	}

	// 공급량 메타데이터의 현재 가격 업데이트
	supply, err := c.getSupply(ctx)
	if err != nil {
		return err
	}
	supply.CurrentPrice = basketPrice
	supply.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	supplyJSON, err := json.Marshal(supply)
	if err != nil {
		return fmt.Errorf("공급량 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState("EPC_SUPPLY", supplyJSON)
}

// GetPrice - 최신 가격 조회
func (c *EPCContract) GetPrice(ctx contractapi.TransactionContextInterface) (*PriceRecord, error) {
	recordJSON, err := ctx.GetStub().GetState("EPC_LATEST_PRICE")
	if err != nil {
		return nil, fmt.Errorf("가격 조회 실패: %v", err)
	}
	if recordJSON == nil {
		return nil, fmt.Errorf("가격 데이터가 없습니다")
	}

	var record PriceRecord
	if err := json.Unmarshal(recordJSON, &record); err != nil {
		return nil, fmt.Errorf("가격 역직렬화 실패: %v", err)
	}

	return &record, nil
}

// GetPriceHistory - 가격 이력 조회
func (c *EPCContract) GetPriceHistory(ctx contractapi.TransactionContextInterface, priceID string) ([]PriceRecord, error) {
	historyIter, err := ctx.GetStub().GetHistoryForKey("PRICE_" + priceID)
	if err != nil {
		return nil, fmt.Errorf("가격 이력 조회 실패: %v", err)
	}
	defer historyIter.Close()

	var records []PriceRecord
	for historyIter.HasNext() {
		result, err := historyIter.Next()
		if err != nil {
			return nil, fmt.Errorf("이력 순회 실패: %v", err)
		}

		var record PriceRecord
		if err := json.Unmarshal(result.Value, &record); err != nil {
			continue
		}
		records = append(records, record)
	}

	return records, nil
}

// Mint - EPC 토큰 발행
func (c *EPCContract) Mint(ctx contractapi.TransactionContextInterface, userID string, amount float64, reason string, refID string) error {
	if amount <= 0 {
		return fmt.Errorf("발행량은 0보다 커야 합니다")
	}

	// 사용자 잔액 업데이트
	balance, err := c.getOrCreateBalance(ctx, userID)
	if err != nil {
		return err
	}
	balance.Balance += amount
	balance.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := c.saveBalance(ctx, balance); err != nil {
		return err
	}

	// 공급량 업데이트
	supply, err := c.getSupply(ctx)
	if err != nil {
		return err
	}
	supply.TotalSupply += amount
	supply.TotalMinted += amount
	supply.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	supplyJSON, err := json.Marshal(supply)
	if err != nil {
		return fmt.Errorf("공급량 직렬화 실패: %v", err)
	}
	if err := ctx.GetStub().PutState("EPC_SUPPLY", supplyJSON); err != nil {
		return fmt.Errorf("공급량 저장 실패: %v", err)
	}

	// 거래 기록
	txID := ctx.GetStub().GetTxID()
	tx := TokenTransaction{
		TxID:      txID,
		Type:      "MINT",
		From:      "",
		To:        userID,
		Amount:    amount,
		Reason:    reason,
		RefID:     refID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	txJSON, err := json.Marshal(tx)
	if err != nil {
		return fmt.Errorf("거래 기록 직렬화 실패: %v", err)
	}
	if err := ctx.GetStub().PutState("TX_"+txID, txJSON); err != nil {
		return fmt.Errorf("거래 기록 저장 실패: %v", err)
	}

	// 이벤트 발생
	ctx.GetStub().SetEvent("MintEvent", txJSON)

	return nil
}

// Burn - EPC 토큰 소각
func (c *EPCContract) Burn(ctx contractapi.TransactionContextInterface, userID string, amount float64, reason string, refID string) error {
	if amount <= 0 {
		return fmt.Errorf("소각량은 0보다 커야 합니다")
	}

	balance, err := c.getOrCreateBalance(ctx, userID)
	if err != nil {
		return err
	}

	if balance.Balance < amount {
		return fmt.Errorf("잔액 부족: 현재 %.2f, 필요 %.2f", balance.Balance, amount)
	}

	balance.Balance -= amount
	balance.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := c.saveBalance(ctx, balance); err != nil {
		return err
	}

	// 공급량 업데이트
	supply, err := c.getSupply(ctx)
	if err != nil {
		return err
	}
	supply.TotalSupply -= amount
	supply.TotalBurned += amount
	supply.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	supplyJSON, err := json.Marshal(supply)
	if err != nil {
		return fmt.Errorf("공급량 직렬화 실패: %v", err)
	}
	if err := ctx.GetStub().PutState("EPC_SUPPLY", supplyJSON); err != nil {
		return fmt.Errorf("공급량 저장 실패: %v", err)
	}

	// 거래 기록
	txID := ctx.GetStub().GetTxID()
	tx := TokenTransaction{
		TxID:      txID,
		Type:      "BURN",
		From:      userID,
		To:        "",
		Amount:    amount,
		Reason:    reason,
		RefID:     refID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	txJSON, err := json.Marshal(tx)
	if err != nil {
		return fmt.Errorf("거래 기록 직렬화 실패: %v", err)
	}
	if err := ctx.GetStub().PutState("TX_"+txID, txJSON); err != nil {
		return fmt.Errorf("거래 기록 저장 실패: %v", err)
	}

	ctx.GetStub().SetEvent("BurnEvent", txJSON)

	return nil
}

// Transfer - EPC 토큰 이체
func (c *EPCContract) Transfer(ctx contractapi.TransactionContextInterface, fromUserID string, toUserID string, amount float64, reason string, refID string) error {
	if amount <= 0 {
		return fmt.Errorf("이체량은 0보다 커야 합니다")
	}
	if fromUserID == toUserID {
		return fmt.Errorf("자기 자신에게 이체할 수 없습니다")
	}

	fromBalance, err := c.getOrCreateBalance(ctx, fromUserID)
	if err != nil {
		return err
	}

	availableBalance := fromBalance.Balance - fromBalance.LockedBalance
	if availableBalance < amount {
		return fmt.Errorf("가용 잔액 부족: 가용 %.2f, 필요 %.2f", availableBalance, amount)
	}

	toBalance, err := c.getOrCreateBalance(ctx, toUserID)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	fromBalance.Balance -= amount
	fromBalance.UpdatedAt = now
	toBalance.Balance += amount
	toBalance.UpdatedAt = now

	if err := c.saveBalance(ctx, fromBalance); err != nil {
		return err
	}
	if err := c.saveBalance(ctx, toBalance); err != nil {
		return err
	}

	// 거래 기록
	txID := ctx.GetStub().GetTxID()
	tx := TokenTransaction{
		TxID:      txID,
		Type:      "TRANSFER",
		From:      fromUserID,
		To:        toUserID,
		Amount:    amount,
		Reason:    reason,
		RefID:     refID,
		CreatedAt: now,
	}

	txJSON, err := json.Marshal(tx)
	if err != nil {
		return fmt.Errorf("거래 기록 직렬화 실패: %v", err)
	}
	if err := ctx.GetStub().PutState("TX_"+txID, txJSON); err != nil {
		return fmt.Errorf("거래 기록 저장 실패: %v", err)
	}

	ctx.GetStub().SetEvent("TransferEvent", txJSON)

	return nil
}

// Lock - 거래 대기 잠금
func (c *EPCContract) Lock(ctx contractapi.TransactionContextInterface, userID string, amount float64, refID string) error {
	if amount <= 0 {
		return fmt.Errorf("잠금량은 0보다 커야 합니다")
	}

	balance, err := c.getOrCreateBalance(ctx, userID)
	if err != nil {
		return err
	}

	availableBalance := balance.Balance - balance.LockedBalance
	if availableBalance < amount {
		return fmt.Errorf("가용 잔액 부족: 가용 %.2f, 필요 %.2f", availableBalance, amount)
	}

	balance.LockedBalance += amount
	balance.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := c.saveBalance(ctx, balance); err != nil {
		return err
	}

	// 거래 기록
	txID := ctx.GetStub().GetTxID()
	tx := TokenTransaction{
		TxID:      txID,
		Type:      "LOCK",
		From:      userID,
		To:        "",
		Amount:    amount,
		Reason:    "trade_lock",
		RefID:     refID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	txJSON, _ := json.Marshal(tx)
	ctx.GetStub().PutState("TX_"+txID, txJSON)
	ctx.GetStub().SetEvent("LockEvent", txJSON)

	return nil
}

// Unlock - 잠금 해제
func (c *EPCContract) Unlock(ctx contractapi.TransactionContextInterface, userID string, amount float64, refID string) error {
	if amount <= 0 {
		return fmt.Errorf("해제량은 0보다 커야 합니다")
	}

	balance, err := c.getOrCreateBalance(ctx, userID)
	if err != nil {
		return err
	}

	if balance.LockedBalance < amount {
		return fmt.Errorf("잠금 잔액 부족: 현재 잠금 %.2f, 해제 요청 %.2f", balance.LockedBalance, amount)
	}

	balance.LockedBalance -= amount
	balance.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := c.saveBalance(ctx, balance); err != nil {
		return err
	}

	txID := ctx.GetStub().GetTxID()
	tx := TokenTransaction{
		TxID:      txID,
		Type:      "UNLOCK",
		From:      "",
		To:        userID,
		Amount:    amount,
		Reason:    "trade_unlock",
		RefID:     refID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	txJSON, _ := json.Marshal(tx)
	ctx.GetStub().PutState("TX_"+txID, txJSON)
	ctx.GetStub().SetEvent("UnlockEvent", txJSON)

	return nil
}

// BalanceOf - 사용자 잔액 조회
func (c *EPCContract) BalanceOf(ctx contractapi.TransactionContextInterface, userID string) (*TokenBalance, error) {
	return c.getOrCreateBalance(ctx, userID)
}

// TotalSupply - 전체 공급량 조회
func (c *EPCContract) TotalSupply(ctx contractapi.TransactionContextInterface) (*TokenSupply, error) {
	return c.getSupply(ctx)
}

// ========== 내부 헬퍼 ==========

func (c *EPCContract) getOrCreateBalance(ctx contractapi.TransactionContextInterface, userID string) (*TokenBalance, error) {
	balanceJSON, err := ctx.GetStub().GetState("BAL_" + userID)
	if err != nil {
		return nil, fmt.Errorf("잔액 조회 실패: %v", err)
	}

	if balanceJSON == nil {
		return &TokenBalance{
			UserID:        userID,
			Balance:       0,
			LockedBalance: 0,
			UpdatedAt:     time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	var balance TokenBalance
	if err := json.Unmarshal(balanceJSON, &balance); err != nil {
		return nil, fmt.Errorf("잔액 역직렬화 실패: %v", err)
	}

	return &balance, nil
}

func (c *EPCContract) saveBalance(ctx contractapi.TransactionContextInterface, balance *TokenBalance) error {
	balanceJSON, err := json.Marshal(balance)
	if err != nil {
		return fmt.Errorf("잔액 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState("BAL_"+balance.UserID, balanceJSON)
}

func (c *EPCContract) getSupply(ctx contractapi.TransactionContextInterface) (*TokenSupply, error) {
	supplyJSON, err := ctx.GetStub().GetState("EPC_SUPPLY")
	if err != nil {
		return nil, fmt.Errorf("공급량 조회 실패: %v", err)
	}

	if supplyJSON == nil {
		return &TokenSupply{
			TotalSupply:  0,
			TotalMinted:  0,
			TotalBurned:  0,
			CurrentPrice: 0,
			UpdatedAt:    time.Now().UTC().Format(time.RFC3339),
		}, nil
	}

	var supply TokenSupply
	if err := json.Unmarshal(supplyJSON, &supply); err != nil {
		return nil, fmt.Errorf("공급량 역직렬화 실패: %v", err)
	}

	return &supply, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&EPCContract{})
	if err != nil {
		log.Panicf("EPC 체인코드 생성 실패: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("EPC 체인코드 시작 실패: %v", err)
	}
}

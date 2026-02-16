package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// MeteringContract - 전력 미터링 스마트 컨트랙트
type MeteringContract struct {
	contractapi.Contract
}

// MeterRecord - 미터링 기록
type MeterRecord struct {
	RecordID    string  `json:"recordId"`
	UserID      string  `json:"userId"`
	DeviceID    string  `json:"deviceId"`
	Production  float64 `json:"production"`
	Consumption float64 `json:"consumption"`
	Source      string  `json:"source"`
	Timestamp   string  `json:"timestamp"`
	RecordedAt  string  `json:"recordedAt"`
	Hash        string  `json:"hash"` // 데이터 무결성 해시
}

// RecordMeter - 미터링 데이터 기록
func (c *MeteringContract) RecordMeter(ctx contractapi.TransactionContextInterface, recordID string, userID string, deviceID string, production float64, consumption float64, source string, timestamp string, dataHash string) error {
	now := time.Now().UTC().Format(time.RFC3339)

	record := MeterRecord{
		RecordID:    recordID,
		UserID:      userID,
		DeviceID:    deviceID,
		Production:  production,
		Consumption: consumption,
		Source:      source,
		Timestamp:   timestamp,
		RecordedAt:  now,
		Hash:        dataHash,
	}

	recordJSON, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("미터링 직렬화 실패: %v", err)
	}

	// 복합키: METER_{UserID}_{Timestamp}
	compositeKey := fmt.Sprintf("METER_%s_%s", userID, timestamp)
	if err := ctx.GetStub().PutState(compositeKey, recordJSON); err != nil {
		return fmt.Errorf("미터링 저장 실패: %v", err)
	}

	// recordID로도 조회 가능하도록 인덱스 저장
	return ctx.GetStub().PutState(recordID, recordJSON)
}

// GetMeterRecord - 미터링 기록 조회
func (c *MeteringContract) GetMeterRecord(ctx contractapi.TransactionContextInterface, recordID string) (*MeterRecord, error) {
	recordJSON, err := ctx.GetStub().GetState(recordID)
	if err != nil {
		return nil, fmt.Errorf("미터링 조회 실패: %v", err)
	}
	if recordJSON == nil {
		return nil, fmt.Errorf("미터링 기록을 찾을 수 없습니다: %s", recordID)
	}

	var record MeterRecord
	if err := json.Unmarshal(recordJSON, &record); err != nil {
		return nil, fmt.Errorf("미터링 역직렬화 실패: %v", err)
	}

	return &record, nil
}

// GetMeterHistory - 디바이스 미터링 이력 조회
func (c *MeteringContract) GetMeterHistory(ctx contractapi.TransactionContextInterface, recordID string) ([]MeterRecord, error) {
	historyIterator, err := ctx.GetStub().GetHistoryForKey(recordID)
	if err != nil {
		return nil, fmt.Errorf("미터링 이력 조회 실패: %v", err)
	}
	defer historyIterator.Close()

	var records []MeterRecord
	for historyIterator.HasNext() {
		modification, err := historyIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("이력 반복 실패: %v", err)
		}

		var record MeterRecord
		if err := json.Unmarshal(modification.Value, &record); err != nil {
			continue
		}
		records = append(records, record)
	}

	return records, nil
}

// VerifyMeterData - 미터링 데이터 무결성 검증
func (c *MeteringContract) VerifyMeterData(ctx contractapi.TransactionContextInterface, recordID string, expectedHash string) (bool, error) {
	record, err := c.GetMeterRecord(ctx, recordID)
	if err != nil {
		return false, err
	}

	return record.Hash == expectedHash, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&MeteringContract{})
	if err != nil {
		fmt.Printf("체인코드 생성 실패: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("체인코드 시작 실패: %v\n", err)
	}
}

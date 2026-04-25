package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// DIDContract - DID 인증 관리 스마트 컨트랙트
type DIDContract struct {
	contractapi.Contract
}

// DIDDocument - DID 문서 구조체
type DIDDocument struct {
	DID        string   `json:"did"`
	UserID     string   `json:"userId"`
	PublicKey  string   `json:"publicKey"`
	AuthMethod string   `json:"authMethod"`
	Role       string   `json:"role"`
	Org        string   `json:"org"`
	Status     string   `json:"status"` // ACTIVE, REVOKED
	CreatedAt  string   `json:"createdAt"`
	UpdatedAt  string   `json:"updatedAt"`
	Services   []Service `json:"services"`
}

// Service - DID 서비스 엔드포인트
type Service struct {
	ID              string `json:"id"`
	Type            string `json:"type"`
	ServiceEndpoint string `json:"serviceEndpoint"`
}

// VerificationResult - DID 검증 결과
type VerificationResult struct {
	Valid   bool   `json:"valid"`
	DID     string `json:"did"`
	Message string `json:"message"`
}

// CreateDID - 새 DID 문서 생성
func (c *DIDContract) CreateDID(ctx contractapi.TransactionContextInterface, did string, userID string, publicKey string, role string, org string) error {
	existing, err := ctx.GetStub().GetState(did)
	if err != nil {
		return fmt.Errorf("DID 조회 실패: %v", err)
	}
	if existing != nil {
		return fmt.Errorf("DID가 이미 존재합니다: %s", did)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	doc := DIDDocument{
		DID:        did,
		UserID:     userID,
		PublicKey:  publicKey,
		AuthMethod: "Ed25519VerificationKey2020",
		Role:       role,
		Org:        org,
		Status:     "ACTIVE",
		CreatedAt:  now,
		UpdatedAt:  now,
		Services:   []Service{},
	}

	docJSON, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("DID 직렬화 실패: %v", err)
	}

	// DID -> Document 매핑
	if err := ctx.GetStub().PutState(did, docJSON); err != nil {
		return fmt.Errorf("DID 저장 실패: %v", err)
	}

	// UserID -> DID 역방향 인덱스
	if err := ctx.GetStub().PutState("USER_"+userID, []byte(did)); err != nil {
		return fmt.Errorf("사용자-DID 인덱스 저장 실패: %v", err)
	}

	return nil
}

// GetDID - DID 문서 조회
func (c *DIDContract) GetDID(ctx contractapi.TransactionContextInterface, did string) (*DIDDocument, error) {
	docJSON, err := ctx.GetStub().GetState(did)
	if err != nil {
		return nil, fmt.Errorf("DID 조회 실패: %v", err)
	}
	if docJSON == nil {
		return nil, fmt.Errorf("DID를 찾을 수 없습니다: %s", did)
	}

	var doc DIDDocument
	if err := json.Unmarshal(docJSON, &doc); err != nil {
		return nil, fmt.Errorf("DID 역직렬화 실패: %v", err)
	}

	return &doc, nil
}

// GetDIDByUserID - 사용자 ID로 DID 조회
func (c *DIDContract) GetDIDByUserID(ctx contractapi.TransactionContextInterface, userID string) (*DIDDocument, error) {
	did, err := ctx.GetStub().GetState("USER_" + userID)
	if err != nil {
		return nil, fmt.Errorf("사용자 DID 조회 실패: %v", err)
	}
	if did == nil {
		return nil, fmt.Errorf("사용자의 DID를 찾을 수 없습니다: %s", userID)
	}

	return c.GetDID(ctx, string(did))
}

// VerifyDID - DID 유효성 검증
func (c *DIDContract) VerifyDID(ctx contractapi.TransactionContextInterface, did string, publicKey string) (*VerificationResult, error) {
	doc, err := c.GetDID(ctx, did)
	if err != nil {
		return &VerificationResult{Valid: false, DID: did, Message: "DID를 찾을 수 없습니다"}, nil
	}

	if doc.Status != "ACTIVE" {
		return &VerificationResult{Valid: false, DID: did, Message: "DID가 비활성 상태입니다"}, nil
	}

	if doc.PublicKey != publicKey {
		return &VerificationResult{Valid: false, DID: did, Message: "공개키가 일치하지 않습니다"}, nil
	}

	return &VerificationResult{Valid: true, DID: did, Message: "DID 검증 성공"}, nil
}

// RevokeDID - DID 폐기
func (c *DIDContract) RevokeDID(ctx contractapi.TransactionContextInterface, did string) error {
	doc, err := c.GetDID(ctx, did)
	if err != nil {
		return err
	}

	doc.Status = "REVOKED"
	doc.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	docJSON, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("DID 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(did, docJSON)
}

// AddService - DID 서비스 엔드포인트 추가
func (c *DIDContract) AddService(ctx contractapi.TransactionContextInterface, did string, serviceID string, serviceType string, endpoint string) error {
	doc, err := c.GetDID(ctx, did)
	if err != nil {
		return err
	}

	service := Service{
		ID:              serviceID,
		Type:            serviceType,
		ServiceEndpoint: endpoint,
	}

	doc.Services = append(doc.Services, service)
	doc.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	docJSON, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("DID 직렬화 실패: %v", err)
	}

	return ctx.GetStub().PutState(did, docJSON)
}

func main() {
	chaincode, err := contractapi.NewChaincode(&DIDContract{})
	if err != nil {
		fmt.Printf("체인코드 생성 실패: %v\n", err)
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("체인코드 시작 실패: %v\n", err)
	}
}

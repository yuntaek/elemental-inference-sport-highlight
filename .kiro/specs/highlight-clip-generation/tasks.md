# Implementation Plan: Highlight Clip Generation

## Overview

라이브 스포츠 방송 하이라이트 이벤트에서 비디오 클립을 생성하는 기능을 구현합니다. 기존 Lambda 함수를 확장하고, 프론트엔드 컴포넌트를 추가하여 클립 생성/조회/다운로드 기능을 제공합니다.

## Tasks

- [x] 1. 타입 정의 및 유틸리티 함수 구현
  - [x] 1.1 Clip 관련 타입 정의 추가 (`src/app/types/events.ts`)
    - ClipStatus, Clip, CreateClipRequest, CreateClipResponse 타입 정의
    - _Requirements: 1.1, 1.4, 3.2_
  - [x] 1.2 Time-shift URL 생성 유틸리티 함수 구현 (`src/app/utils/clip-utils.ts`)
    - PTS → 초 변환 함수
    - ISO 8601 형식 변환 함수
    - Time-shift URL 생성 함수
    - Time-shift 윈도우 검증 함수 (24시간)
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 1.3 Time-shift URL 생성 속성 테스트 작성
    - **Property 3: Time-shift URL 형식 정확성**
    - **Property 4: Time-shift 윈도우 범위 검증**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. API 클라이언트 함수 구현
  - [x] 2.1 클립 생성 API 함수 추가 (`src/app/utils/aws-api.ts`)
    - createClip: POST /clips 요청
    - 필수 파라미터 검증 로직
    - _Requirements: 1.1, 1.3_
  - [x] 2.2 클립 상태 조회 API 함수 추가
    - getClipStatus: GET /clips/:id 요청
    - getChannelClips: GET /channels/:id/clips 요청
    - _Requirements: 4.1_
  - [x] 2.3 클립 다운로드 URL 생성 함수 추가
    - getClipDownloadUrl: presigned URL 요청
    - _Requirements: 5.1_
  - [x] 2.4 API 파라미터 검증 속성 테스트 작성
    - **Property 1: 클립 생성 요청 파라미터 완전성**
    - **Validates: Requirements 1.1, 1.3**

- [x] 3. Checkpoint - 유틸리티 및 API 함수 검증
  - 모든 테스트 통과 확인, 문제 발생 시 사용자에게 문의

- [x] 4. 클립 상태 관리 훅 구현
  - [x] 4.1 useClipStatus 훅 구현 (`src/app/hooks/use-clip-status.ts`)
    - 단일 클립 상태 폴링 (5초 간격)
    - PROCESSING 상태일 때만 폴링 활성화
    - 상태 변경 시 콜백 호출
    - _Requirements: 4.2, 4.3_
  - [x] 4.2 useBatchClipStatus 훅 구현
    - 여러 클립 상태 동시 추적
    - 전체 진행률 계산
    - _Requirements: 7.2, 7.4_
  - [x] 4.3 상태 전이 속성 테스트 작성
    - **Property 5: 클립 상태 전이 일관성**
    - **Validates: Requirements 1.2, 3.2, 3.3, 3.4**

- [x] 5. UI 컴포넌트 구현
  - [x] 5.1 ClipStatusBadge 컴포넌트 구현 (`src/app/components/clip-status-badge.tsx`)
    - PENDING, PROCESSING, COMPLETED, FAILED 상태 표시
    - PROCESSING 시 로딩 애니메이션
    - _Requirements: 4.1_
  - [x] 5.2 ClipGeneratorButton 컴포넌트 구현 (`src/app/components/clip-generator-button.tsx`)
    - 클립 생성 버튼 UI
    - 로딩 상태 표시
    - 에러 처리 및 Toast 알림
    - _Requirements: 1.1, 1.2_
  - [x] 5.3 ClipCard 컴포넌트 구현 (`src/app/components/clip-card.tsx`)
    - 클립 썸네일 및 메타데이터 표시
    - 미리보기 버튼 (COMPLETED 상태)
    - 다운로드 버튼 (COMPLETED 상태)
    - 상태 배지 표시
    - _Requirements: 5.1, 6.1, 6.2_
  - [x] 5.4 ClipCard 메타데이터 표시 속성 테스트 작성
    - **Property 6: 클립 메타데이터 표시 완전성**
    - **Validates: Requirements 6.2**

- [x] 6. Checkpoint - UI 컴포넌트 검증
  - 모든 테스트 통과 확인, 문제 발생 시 사용자에게 문의

- [x] 7. 일괄 클립 생성 기능 구현
  - [x] 7.1 BatchClipGenerator 컴포넌트 구현 (`src/app/components/batch-clip-generator.tsx`)
    - 이벤트 다중 선택 UI
    - 일괄 클립 생성 버튼
    - 전체 진행률 표시
    - _Requirements: 7.1, 7.4_
  - [x] 7.2 일괄 클립 생성 로직 구현
    - 선택된 이벤트별 개별 요청 전송
    - 부분 실패 처리 (성공/실패 분리 표시)
    - _Requirements: 7.2, 7.3_
  - [x] 7.3 일괄 클립 생성 속성 테스트 작성
    - **Property 7: 일괄 클립 생성 요청 수 일치**
    - **Property 8: 일괄 클립 상태 독립성**
    - **Property 9: 일괄 클립 진행률 정확성**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [-] 8. 기존 컴포넌트 통합
  - [-] 8.1 ChannelDetailModal에 클립 생성 버튼 추가
    - 이벤트 카드에 ClipGeneratorButton 통합
    - 클립 상태 표시 추가
    - _Requirements: 1.1, 4.1_
  - [ ] 8.2 ChannelDetailModal에 클립 미리보기 기능 추가
    - ClipCard 클릭 시 비디오 플레이어에서 재생
    - 메타데이터 표시
    - _Requirements: 6.1, 6.2_
  - [ ] 8.3 ChannelDetailModal에 일괄 클립 생성 기능 추가
    - 이벤트 다중 선택 체크박스
    - BatchClipGenerator 통합
    - _Requirements: 7.1_

- [ ] 9. Lambda 함수 확장
  - [ ] 9.1 API Gateway 트리거 지원 추가 (`lambda/clip-generator/index.mjs`)
    - POST /clips 핸들러 추가
    - GET /clips/:id 핸들러 추가
    - 필수 파라미터 검증
    - _Requirements: 1.3, 4.1_
  - [ ] 9.2 Time-shift URL 생성 로직 추가
    - timestamp 기반 start/end 파라미터 계산
    - 24시간 윈도우 검증
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 9.3 클립 상태 업데이트 로직 추가
    - MediaConvert Job 완료/실패 이벤트 처리
    - DynamoDB 상태 업데이트
    - _Requirements: 3.3, 3.4_
  - [ ] 9.4 clipId 고유성 속성 테스트 작성
    - **Property 2: 클립 ID 고유성**
    - **Validates: Requirements 1.4**

- [ ] 10. Final Checkpoint - 전체 기능 검증
  - 모든 테스트 통과 확인, 문제 발생 시 사용자에게 문의

## Notes

- 모든 태스크(테스트 포함)가 필수로 설정되어 있습니다
- 각 태스크는 특정 요구사항을 참조하여 추적 가능합니다
- Property 테스트는 fast-check 라이브러리를 사용합니다
- Checkpoint에서 모든 테스트가 통과해야 다음 단계로 진행합니다

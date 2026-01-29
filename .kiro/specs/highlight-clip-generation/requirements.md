# Requirements Document

## Introduction

라이브 스포츠 방송 중 하이라이트 이벤트에서 비디오 클립을 생성하는 기능입니다. 사용자가 스포츠 이벤트(3점슛, 덩크, 인시던트 등)를 선택하면 MediaPackage의 Time-shift 기능을 활용하여 해당 구간의 비디오 클립을 생성하고 다운로드할 수 있습니다. 라이브 스트림에서 과거 시점의 영상을 추출하기 위해 Time-shift URL 파라미터를 사용합니다.

## Glossary

- **Clip_Generator**: 하이라이트 이벤트의 시작/종료 시점을 기반으로 비디오 클립을 생성하는 시스템
- **Sport_Event**: 스포츠 경기 중 감지된 하이라이트 이벤트 (3점슛, 덩크, 인시던트 등)
- **MediaConvert_Job**: AWS MediaConvert에서 비디오 변환 작업을 수행하는 단위
- **Clip_Status**: 클립 생성 작업의 현재 상태 (PENDING, PROCESSING, COMPLETED, FAILED)
- **PTS**: Presentation Time Stamp - 비디오 프레임의 타임스탬프
- **Timescale**: PTS를 초 단위로 변환하기 위한 스케일 값
- **Time_Shift**: MediaPackage의 기능으로, 라이브 스트림의 과거 시점 영상에 접근할 수 있게 해주는 기능
- **Time_Shift_URL**: start/end 파라미터를 포함한 HLS URL로, 특정 시간 구간의 영상을 요청

## Requirements

### Requirement 1: 클립 생성 요청

**User Story:** As a 운영자, I want to 하이라이트 이벤트에서 클립 생성을 요청, so that I can 해당 구간의 비디오를 별도 파일로 저장할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 이벤트 상세 화면에서 "클립 생성" 버튼을 클릭 THEN THE Clip_Generator SHALL 해당 이벤트의 startPts, endPts, timescale, timestamp 정보를 포함한 클립 생성 요청을 API로 전송
2. WHEN 클립 생성 요청이 전송됨 THEN THE Clip_Generator SHALL 요청 상태를 PENDING으로 설정하고 사용자에게 진행 중임을 표시
3. IF 필수 파라미터(startPts, endPts, channelId, timestamp)가 누락됨 THEN THE Clip_Generator SHALL 에러 메시지를 반환하고 요청을 거부
4. WHEN 클립 생성 요청이 성공적으로 전송됨 THEN THE Clip_Generator SHALL 고유한 clipId를 생성하여 반환

### Requirement 2: Time-shift URL 생성

**User Story:** As a 시스템, I want to 이벤트 발생 시점 기준으로 Time-shift URL을 생성, so that I can 라이브 방송 중 과거 시점의 영상에 접근할 수 있다.

#### Acceptance Criteria

1. WHEN 클립 생성 요청이 수신됨 THEN THE Clip_Generator SHALL 이벤트의 timestamp를 기준으로 start/end 파라미터가 포함된 Time_Shift_URL을 생성
2. WHEN Time_Shift_URL을 생성할 때 THEN THE Clip_Generator SHALL ISO 8601 형식(예: ?start=2024-01-01T12:00:00Z&end=2024-01-01T12:00:30Z)으로 시간 파라미터를 설정
3. WHEN 이벤트 발생 시점이 Time-shift 윈도우(기본 24시간) 범위를 벗어남 THEN THE Clip_Generator SHALL 에러 메시지를 반환하고 클립 생성 불가를 알림

### Requirement 3: 클립 생성 처리

**User Story:** As a 시스템, I want to MediaConvert를 통해 클립을 생성, so that I can Time-shift된 HLS 스트림에서 MP4 파일을 추출할 수 있다.

#### Acceptance Criteria

1. WHEN Time_Shift_URL이 생성됨 THEN THE Clip_Generator SHALL 해당 URL을 입력으로 MediaConvert Job을 생성하여 MP4로 변환
2. WHEN MediaConvert Job이 생성됨 THEN THE Clip_Generator SHALL 클립 메타데이터를 DynamoDB에 저장하고 상태를 PROCESSING으로 설정
3. WHEN MediaConvert Job이 완료됨 THEN THE Clip_Generator SHALL 클립 상태를 COMPLETED로 업데이트하고 S3 URL을 저장
4. IF MediaConvert Job이 실패함 THEN THE Clip_Generator SHALL 클립 상태를 FAILED로 업데이트하고 에러 정보를 저장

### Requirement 4: 클립 상태 조회

**User Story:** As a 운영자, I want to 클립 생성 진행 상태를 확인, so that I can 클립이 준비되었는지 알 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 이벤트 목록을 조회 THEN THE Clip_Generator SHALL 각 이벤트의 클립 생성 상태(PENDING, PROCESSING, COMPLETED, FAILED)를 표시
2. WHILE 클립 상태가 PROCESSING THEN THE Clip_Generator SHALL 5초마다 상태를 폴링하여 UI를 업데이트
3. WHEN 클립 상태가 COMPLETED로 변경됨 THEN THE Clip_Generator SHALL 다운로드 버튼을 활성화

### Requirement 5: 클립 다운로드

**User Story:** As a 운영자, I want to 생성된 클립을 다운로드, so that I can 로컬에서 비디오를 사용할 수 있다.

#### Acceptance Criteria

1. WHEN 클립 상태가 COMPLETED이고 사용자가 다운로드 버튼을 클릭 THEN THE Clip_Generator SHALL S3 presigned URL을 생성하여 다운로드를 시작
2. WHEN 다운로드가 시작됨 THEN THE Clip_Generator SHALL 브라우저의 기본 다운로드 기능을 통해 파일을 저장
3. IF 클립 파일이 S3에 존재하지 않음 THEN THE Clip_Generator SHALL 에러 메시지를 표시하고 클립 상태를 FAILED로 업데이트

### Requirement 6: 클립 미리보기

**User Story:** As a 운영자, I want to 생성된 클립을 미리보기, so that I can 다운로드 전에 내용을 확인할 수 있다.

#### Acceptance Criteria

1. WHEN 클립 상태가 COMPLETED이고 사용자가 클립 카드를 클릭 THEN THE Clip_Generator SHALL 비디오 플레이어에서 클립을 재생
2. WHEN 클립 미리보기가 표시됨 THEN THE Clip_Generator SHALL 클립의 메타데이터(이벤트 타입, 시간, 길이)를 함께 표시

### Requirement 7: 일괄 클립 생성

**User Story:** As a 운영자, I want to 여러 이벤트의 클립을 한번에 생성, so that I can 효율적으로 작업할 수 있다.

#### Acceptance Criteria

1. WHEN 사용자가 여러 이벤트를 선택하고 "일괄 클립 생성" 버튼을 클릭 THEN THE Clip_Generator SHALL 선택된 모든 이벤트에 대해 클립 생성 요청을 전송
2. WHEN 일괄 클립 생성이 요청됨 THEN THE Clip_Generator SHALL 각 클립의 진행 상태를 개별적으로 추적하고 표시
3. IF 일부 클립 생성이 실패함 THEN THE Clip_Generator SHALL 실패한 클립만 표시하고 성공한 클립은 정상 처리
4. WHEN 일괄 클립 생성 중 THEN THE Clip_Generator SHALL 전체 진행률(완료/전체)을 표시

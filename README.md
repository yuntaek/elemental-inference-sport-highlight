# Sports Event Monitoring Dashboard

AWS MediaLive 채널과 연동하여 스포츠 이벤트(3점슛, 덩크, 사건 등)를 실시간으로 모니터링하고 YouTube 숏츠 제작을 지원하는 React 대시보드입니다.

## 주요 기능

- **채널 모니터링**: MediaLive 채널 상태 및 실시간 HLS 스트림 미리보기
- **실시간 이벤트 감지**: 스포츠 이벤트(3점슛, 덩크, 사건) 5초 간격 폴링
- **이벤트 상세 조회**: PTS 정보, 태그, 클립 URL 등 상세 정보 확인
- **하이라이트 클립 생성**: MediaPackage Time-shift 기반 비디오 클립 추출 및 다운로드
- **숏츠 제작 대기열**: 이벤트 클립 선택 및 YouTube 숏츠 배포 준비
- **HLS 비디오 플레이어**: 라이브 스트림 및 클립 재생

### 하이라이트 클립 생성

라이브 방송 중 하이라이트 이벤트에서 비디오 클립을 생성하는 기능입니다:

- **클립 생성**: 이벤트의 PTS 정보를 기반으로 Time-shift URL 생성 후 MediaConvert로 MP4 변환
- **상태 추적**: PENDING → PROCESSING → COMPLETED/FAILED 상태 폴링
- **클립 미리보기/다운로드**: 생성 완료된 클립의 재생 및 S3 presigned URL 다운로드
- **일괄 생성**: 여러 이벤트 선택 후 일괄 클립 생성 지원

## 기술 스택

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide React (아이콘)
- HLS.js (비디오 스트리밍)

## AWS 연동

- **MediaLive**: 채널 상태 조회 (us-west-2)
- **MediaPackage**: Time-shift 기능으로 과거 시점 영상 접근 (24시간 윈도우)
- **MediaConvert**: HLS → MP4 클립 변환
- **DynamoDB**: 클립 메타데이터 및 상태 저장
- **S3**: 생성된 클립 파일 저장
- **API Gateway**: REST API (`https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com`)
- **Amplify**: 프론트엔드 호스팅

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 프로젝트 구조

```
src/
├── app/
│   ├── components/
│   │   ├── dashboard.tsx          # 메인 대시보드
│   │   ├── channel-card.tsx       # 채널 카드 (미리보기, 이벤트 목록)
│   │   ├── channel-detail-modal.tsx # 채널 상세 모달
│   │   ├── clip-card.tsx          # 클립 카드 (미리보기, 다운로드)
│   │   ├── clip-generator-button.tsx # 클립 생성 버튼
│   │   ├── clip-status-badge.tsx  # 클립 상태 배지
│   │   ├── shorts-sidebar.tsx     # 숏츠 제작 대기열
│   │   ├── video-player.tsx       # HLS 비디오 플레이어
│   │   └── event-badge.tsx        # 이벤트 타입 배지
│   ├── context/
│   │   └── shorts-context.tsx     # 숏츠 대기열 상태 관리
│   ├── hooks/
│   │   └── use-clip-status.ts     # 클립 상태 폴링 훅
│   ├── types/
│   │   └── events.ts              # TypeScript 타입 정의 (Clip, ClipStatus 포함)
│   └── utils/
│       ├── aws-api.ts             # AWS API 호출 (클립 생성/조회 포함)
│       ├── clip-utils.ts          # Time-shift URL 생성 유틸리티
│       └── event-colors.ts        # 이벤트 스타일링
├── styles/                        # 글로벌 스타일
└── main.tsx                       # 앱 진입점
```

## 배포 가이드

### 사전 요구사항

- AWS CLI 설치 및 구성 (`aws configure`)
- Node.js 18+ 및 npm
- AWS 계정 및 적절한 IAM 권한

### 1. 프론트엔드 배포 (AWS Amplify)

프론트엔드는 AWS Amplify를 통해 호스팅됩니다.

```bash
# 1. 프로덕션 빌드
npm run build

# 2. 빌드 결과물 압축
cd dist && zip -r ../amplify-deploy.zip . && cd ..

# 3. Amplify 콘솔에서 수동 배포
# - AWS Amplify 콘솔 접속
# - 앱 선택 후 "Deploy without Git provider" 선택
# - amplify-deploy.zip 파일 업로드
```

또는 Git 연동 배포:
```bash
# Git에 푸시하면 Amplify가 자동으로 빌드 및 배포
git push origin main
```

### 2. Lambda 함수 배포

#### 메인 API Lambda (`lambda/`)

```bash
# 1. Lambda 함수 패키징
cd lambda
zip -r function.zip index.mjs

# 2. Lambda 함수 업데이트
aws lambda update-function-code \
  --function-name highlight-api \
  --zip-file fileb://function.zip \
  --region us-west-2
```

#### 클립 생성 Lambda (`lambda/clip-generator/`)

```bash
# 1. 의존성 설치 및 패키징
cd lambda/clip-generator
npm install
zip -r function.zip index.mjs node_modules package.json

# 2. Lambda 함수 배포 (없으면 생성, 있으면 업데이트)
# 함수 존재 여부 확인 후 생성 또는 업데이트
aws lambda get-function --function-name clip-generator --region us-west-2 2>/dev/null \
  && aws lambda update-function-code \
       --function-name clip-generator \
       --zip-file fileb://function.zip \
       --region us-west-2 \
  || aws lambda create-function \
       --function-name clip-generator \
       --runtime nodejs20.x \
       --role arn:aws:iam::083304596944:role/clip-generator-role \
       --handler index.handler \
       --zip-file fileb://function.zip \
       --timeout 60 \
       --memory-size 256 \
       --region us-west-2
```

Lambda 실행 역할이 없는 경우 먼저 생성:

```bash
# IAM 역할 생성
aws iam create-role \
  --role-name clip-generator-role \
  --assume-role-policy-document file://../trust-policy.json

# 필요한 정책 연결
aws iam attach-role-policy \
  --role-name clip-generator-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name clip-generator-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

aws iam attach-role-policy \
  --role-name clip-generator-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# MediaConvert 권한을 위한 인라인 정책 추가
aws iam put-role-policy \
  --role-name clip-generator-role \
  --policy-name MediaConvertAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["mediaconvert:*", "iam:PassRole"],
      "Resource": "*"
    }]
  }'
```

### 3. AWS 리소스 설정

#### DynamoDB 테이블 생성

```bash
aws dynamodb create-table \
  --table-name highlight-clips-stage \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=channelId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{
      "IndexName": "channelId-timestamp-index",
      "KeySchema": [
        {"AttributeName": "channelId", "KeyType": "HASH"},
        {"AttributeName": "timestamp", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
    }]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-west-2
```

#### S3 버킷 (클립 저장용)

```bash
# 버킷 생성
aws s3 mb s3://hackathon8-output-video --region us-west-2

# CORS 설정
aws s3api put-bucket-cors \
  --bucket hackathon8-output-video \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": []
    }]
  }'
```

#### MediaConvert IAM 역할

```bash
# MediaConvert 역할 생성 (이미 존재하는 경우 생략)
aws iam create-role \
  --role-name MediaConvertRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "mediaconvert.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# S3 접근 권한 부여
aws iam attach-role-policy \
  --role-name MediaConvertRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

### 4. 환경 변수 및 설정

Lambda 함수에서 사용하는 주요 설정값:

| 변수 | 값 | 설명 |
|------|-----|------|
| `REGION` | `us-west-2` | AWS 리전 |
| `BUCKET` | `hackathon8-output-video` | 클립 저장 S3 버킷 |
| `TABLE` | `highlight-clips-stage` | DynamoDB 테이블명 (staging 환경) |
| `MEDIACONVERT_ROLE` | `arn:aws:iam::083304596944:role/MediaConvertRole` | MediaConvert IAM 역할 |
| `TIME_SHIFT_WINDOW_HOURS` | `24` | Time-shift 윈도우 (시간) |

### 5. API Gateway 설정

API Gateway는 다음 엔드포인트를 제공합니다:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/clips` | 클립 생성 요청 |
| `GET` | `/clips/{clipId}` | 클립 상태 조회 |
| `GET` | `/channels/{channelId}/clips` | 채널별 클립 목록 |
| `GET` | `/clips/{clipId}/download` | 다운로드 URL 생성 |

### 6. EventBridge 규칙 (MediaConvert 이벤트)

MediaConvert Job 완료/실패 이벤트를 Lambda로 전달:

```bash
aws events put-rule \
  --name mediaconvert-job-state-change \
  --event-pattern '{
    "source": ["aws.mediaconvert"],
    "detail-type": ["MediaConvert Job State Change"],
    "detail": {
      "status": ["COMPLETE", "ERROR"]
    }
  }' \
  --region us-west-2

aws events put-targets \
  --rule mediaconvert-job-state-change \
  --targets '[{
    "Id": "clip-generator-lambda",
    "Arn": "arn:aws:lambda:us-west-2:083304596944:function:clip-generator"
  }]' \
  --region us-west-2
```

### 테스트

```bash
# 단위 테스트 실행
npm test

# 개발 서버로 로컬 테스트
npm run dev
```

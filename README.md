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

- **클립 생성**: 이벤트의 PTS 정보를 기반으로 Time-shift URL 생성 후 FFmpeg로 MP4 변환
- **Lambda@Edge VOD 변환**: CloudFront Origin Request에서 MediaPackage Time-shift HLS를 VOD 형식으로 변환
- **FFmpeg Lambda Layer**: MediaConvert 대신 FFmpeg를 사용하여 HLS → MP4 직접 변환 (query string 지원)
- **상태 추적**: 동기 처리로 즉시 COMPLETED/FAILED 상태 반환
- **클립 미리보기/다운로드**: 생성 완료된 클립의 재생 및 S3 presigned URL 다운로드
- **EventBridge 연동**: 스포츠 이벤트 감지 시 자동 클립 생성 (40-60초 딜레이 후 처리)

## 기술 스택

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide React (아이콘)
- HLS.js (비디오 스트리밍)

## AWS 연동

- **MediaLive**: 채널 상태 조회 (us-west-2)
- **MediaPackage**: Time-shift 기능으로 과거 시점 영상 접근 (24시간 윈도우)
- **Lambda + FFmpeg Layer**: HLS → MP4 클립 변환 (MediaConvert 대체)
- **Lambda@Edge**: CloudFront Origin Request에서 Time-shift HLS를 VOD 형식으로 변환
- **DynamoDB**: 클립 메타데이터 및 상태 저장
- **S3**: 생성된 클립 파일 저장
- **CloudFront**: HLS 스트리밍 및 클립 배포
- **EventBridge**: 스포츠 이벤트 수신 및 Lambda 트리거
- **API Gateway**: REST API (환경별 분리)
- **Amplify**: 프론트엔드 호스팅

### API 환경

| 환경 | API Gateway URL | Lambda | DynamoDB |
|------|-----------------|--------|----------|
| **Production** | `https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com` | `highlight-manager-api` | `highlight-clips` |
| **Staging** | `https://s08iiuslb1.execute-api.us-west-2.amazonaws.com` | `highlight-manager-api-stage` | `highlight-clips-stage` |

### CloudFront 배포

| 용도 | CloudFront Domain | Origin |
|------|-------------------|--------|
| **HLS Streaming** | `d2byorho3b7g5y.cloudfront.net` | MediaPackage |
| **Clip Storage** | `df1kr6icfg8e8.cloudfront.net` | S3 |

### EventBridge 파이프라인

```
aws.elemental-inference (Clip Metadata Generated)
    ├── CloudWatch Logs (/aws/events/medialivecrop)
    ├── highlight-clip-generator (Production → highlight-clips)
    ├── highlight-clip-generator-stage (Staging → highlight-clips-stage)
    └── clip-transcoder (MediaConvert)
```

### API 엔드포인트

| Method | Path | Description |
|--------|------|-------------|
| GET | `/channels` | 채널 목록 조회 |
| GET | `/channels/{channelId}` | 채널 상세 조회 |
| GET | `/channels/{channelId}/events` | 채널별 이벤트 목록 |
| GET | `/channels/{channelId}/clips` | 채널별 클립 목록 |
| POST | `/clips` | 클립 생성 요청 |
| GET | `/clips` | 전체 클립 목록 |
| GET | `/clips/{clipId}` | 클립 상태 조회 |
| GET | `/clips/{clipId}/download` | 다운로드 URL 생성 |

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (기본: Production API)
npm run dev

# Staging API로 개발 서버 실행
npm run dev -- --mode staging

# 커스텀 API URL로 개발 서버 실행
VITE_API_BASE=https://your-api.example.com npm run dev

# 프로덕션 빌드
npm run build

# Staging 환경 빌드
npm run build -- --mode staging
```

### 환경 변수 설정

API Base URL은 `VITE_API_BASE` 환경 변수로 설정할 수 있습니다:

| 환경 변수 | 설명 | 기본값 |
|----------|------|--------|
| `VITE_API_BASE` | API Gateway Base URL | `https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com` (Production) |

환경별 설정 파일:
- `.env.production` - Production 환경 변수
- `.env.staging` - Staging 환경 변수
- `.env.local` - 로컬 개발용 (Git에서 제외됨)

```bash
# .env.staging 예시
VITE_API_BASE=https://s08iiuslb1.execute-api.us-west-2.amazonaws.com
```

### Amplify 환경별 배포

Amplify 콘솔에서 브랜치별 환경 변수를 설정하거나, `amplify.yml`에서 환경별 빌드 명령어를 지정할 수 있습니다:

```yaml
# amplify.yml 예시
version: 1
frontend:
  phases:
    build:
      commands:
        - npm ci
        - npm run build -- --mode ${AWS_BRANCH}  # main → production, staging → staging
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
```

또는 Amplify 콘솔 > 앱 설정 > 환경 변수에서 `VITE_API_BASE`를 브랜치별로 설정하세요.

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

# 2. Production Lambda 함수 업데이트
aws lambda update-function-code \
  --function-name highlight-manager-api \
  --zip-file fileb://function.zip \
  --region us-west-2

# 3. Staging Lambda 함수 업데이트
aws lambda update-function-code \
  --function-name highlight-manager-api-stage \
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

| 변수 | Production | Staging | 설명 |
|------|------------|---------|------|
| `DYNAMODB_TABLE` | `highlight-clips` | `highlight-clips-stage` | DynamoDB 테이블명 |
| `REGION` | `us-west-2` | `us-west-2` | AWS 리전 |
| `S3_BUCKET` | `hackathon8-output-video` | `hackathon8-output-video` | 클립 저장 S3 버킷 |
| `MEDIACONVERT_ROLE` | `arn:aws:iam::083304596944:role/MediaConvertRole` | - | MediaConvert IAM 역할 |
| `TIME_SHIFT_WINDOW_HOURS` | `24` | `24` | Time-shift 윈도우 (시간) |

#### Lambda 환경 변수 설정

```bash
# Staging API Lambda 환경 변수 설정
aws lambda update-function-configuration \
  --function-name highlight-manager-api-stage \
  --environment "Variables={DYNAMODB_TABLE=highlight-clips-stage}" \
  --region us-west-2
```

### 5. API Gateway 설정

API Gateway는 다음 엔드포인트를 제공합니다:

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/channels` | 채널 목록 조회 |
| `GET` | `/channels/{channelId}` | 채널 상세 조회 |
| `GET` | `/channels/{channelId}/events` | 채널별 이벤트 목록 |
| `GET` | `/channels/{channelId}/clips` | 채널별 클립 목록 |
| `POST` | `/clips` | 클립 생성 요청 |
| `GET` | `/clips` | 전체 클립 목록 |
| `GET` | `/clips/{clipId}` | 클립 상태 조회 |
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

### 7. EventBridge 규칙 (스포츠 이벤트)

Elemental Inference에서 발생하는 스포츠 이벤트를 Lambda로 전달:

```bash
# 현재 설정된 타겟 확인
aws events list-targets-by-rule --rule rule --region us-west-2

# Staging Lambda 타겟 추가
aws events put-targets \
  --rule rule \
  --targets "Id=clip-generator-lambda-stage,Arn=arn:aws:lambda:us-west-2:083304596944:function:highlight-clip-generator-stage" \
  --region us-west-2
```

### 8. CloudFront 배포

MediaPackage HLS 스트리밍을 위한 CloudFront 배포:

```bash
# CloudFront 배포 생성 (이미 생성됨)
# Distribution ID: E3LW2EVVNW4S9P
# Domain: d2byorho3b7g5y.cloudfront.net

# HLS URL 예시
# 기존: https://c4af3793bf76b33c.mediapackage.us-west-2.amazonaws.com/out/v1/038b4469b5c541dc8816deef6ccd4aae/index.m3u8
# CloudFront: https://d2byorho3b7g5y.cloudfront.net/out/v1/038b4469b5c541dc8816deef6ccd4aae/index.m3u8
```

### 테스트

```bash
# 단위 테스트 실행
npm test

# 개발 서버로 로컬 테스트
npm run dev
```

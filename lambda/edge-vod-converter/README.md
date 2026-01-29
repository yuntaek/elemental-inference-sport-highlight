# Lambda@Edge VOD Converter

MediaPackage Time-shift HLS 응답을 VOD 형식으로 변환하는 CloudFront Lambda@Edge 함수입니다.

## 기능

Time-shift 파라미터(`start`, `end`)가 포함된 HLS 요청에 대해:

1. Lambda에서 직접 MediaPackage로 요청
2. `#EXT-X-PLAYLIST-TYPE:EVENT` → `#EXT-X-PLAYLIST-TYPE:VOD` 변환
3. `#EXT-X-ENDLIST` 태그 추가 (없는 경우)
4. 변환된 응답을 CloudFront로 반환

이를 통해 MediaConvert가 Time-shift HLS를 VOD 입력으로 인식하여 정상적으로 클립을 생성할 수 있습니다.

## 동작 방식

Origin Request 트리거에서 동작:
1. Time-shift 파라미터가 있는 `.m3u8` 요청 감지
2. Lambda에서 직접 MediaPackage Origin으로 HTTPS 요청
3. 응답 본문(HLS manifest)을 VOD 형식으로 변환
4. 변환된 응답을 CloudFront에 반환 (Origin으로 전달하지 않음)

## 배포

### 1. IAM 역할 생성 (없는 경우)

```bash
# IAM 역할 생성
aws iam create-role \
  --role-name lambda-edge-role \
  --assume-role-policy-document file://trust-policy.json

# 기본 실행 권한 부여
aws iam attach-role-policy \
  --role-name lambda-edge-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 2. Lambda 함수 생성 (us-east-1 필수)

Lambda@Edge는 반드시 **us-east-1** 리전에 생성해야 합니다.

```bash
cd lambda/edge-vod-converter

# 패키징
zip -r function.zip index.js

# Lambda 함수 생성
aws lambda create-function \
  --function-name edge-vod-converter \
  --runtime nodejs20.x \
  --role arn:aws:iam::083304596944:role/lambda-edge-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 128 \
  --region us-east-1

# 버전 발행 (Lambda@Edge는 버전이 필요)
aws lambda publish-version \
  --function-name edge-vod-converter \
  --region us-east-1
```

### 3. CloudFront 배포에 연결

CloudFront 콘솔 또는 CLI로 HLS 스트리밍 배포(`d2byorho3b7g5y.cloudfront.net`)에 Lambda@Edge를 연결합니다.

```bash
# CloudFront 배포 설정 가져오기
aws cloudfront get-distribution-config \
  --id E3LW2EVVNW4S9P > cf-config.json

# cf-config.json에서 DefaultCacheBehavior 또는 CacheBehaviors에 
# LambdaFunctionAssociations 추가:
#
# "LambdaFunctionAssociations": {
#   "Quantity": 1,
#   "Items": [
#     {
#       "LambdaFunctionARN": "arn:aws:lambda:us-east-1:083304596944:function:edge-vod-converter:1",
#       "EventType": "origin-request"
#     }
#   ]
# }

# 배포 업데이트
aws cloudfront update-distribution \
  --id E3LW2EVVNW4S9P \
  --distribution-config file://cf-config-updated.json \
  --if-match <ETag>
```

### 4. 테스트

```bash
# Time-shift 요청 테스트
curl -v "https://d2byorho3b7g5y.cloudfront.net/out/v1/038b4469b5c541dc8816deef6ccd4aae/index.m3u8?start=2024-01-01T12:00:00Z&end=2024-01-01T12:01:00Z"

# 응답에서 확인:
# - #EXT-X-PLAYLIST-TYPE:VOD
# - #EXT-X-ENDLIST (마지막에)
```

## 주의사항

- Lambda@Edge는 **us-east-1**에만 생성 가능
- **Origin Request** 트리거 사용 (Lambda에서 직접 Origin 요청)
- Time-shift 파라미터가 없는 요청은 원본 Origin으로 전달
- 타임아웃 최대 30초 (Origin Request)

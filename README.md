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

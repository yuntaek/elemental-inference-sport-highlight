# Sports Event Monitoring Dashboard

AWS MediaLive 채널과 연동하여 스포츠 이벤트(3점슛, 덩크, 사건 등)를 실시간으로 모니터링하고 YouTube 숏츠 제작을 지원하는 React 대시보드입니다.

## 주요 기능

- **채널 모니터링**: MediaLive 채널 상태 및 실시간 HLS 스트림 미리보기
- **실시간 이벤트 감지**: 스포츠 이벤트(3점슛, 덩크, 사건) 5초 간격 폴링
- **이벤트 상세 조회**: PTS 정보, 태그, 클립 URL 등 상세 정보 확인
- **숏츠 제작 대기열**: 이벤트 클립 선택 및 YouTube 숏츠 배포 준비
- **HLS 비디오 플레이어**: 라이브 스트림 및 클립 재생

## 기술 스택

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide React (아이콘)
- HLS.js (비디오 스트리밍)

## AWS 연동

- **MediaLive**: 채널 상태 조회 (us-west-2)
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
│   │   ├── shorts-sidebar.tsx     # 숏츠 제작 대기열
│   │   ├── video-player.tsx       # HLS 비디오 플레이어
│   │   └── event-badge.tsx        # 이벤트 타입 배지
│   ├── context/
│   │   └── shorts-context.tsx     # 숏츠 대기열 상태 관리
│   ├── types/
│   │   └── events.ts              # TypeScript 타입 정의
│   └── utils/
│       ├── aws-api.ts             # AWS API 호출
│       └── event-colors.ts        # 이벤트 스타일링
├── styles/                        # 글로벌 스타일
└── main.tsx                       # 앱 진입점
```

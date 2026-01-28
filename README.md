# Sports Event Monitoring Dashboard

AWS MediaLive 채널과 연동하여 스포츠 이벤트(3점슛, 덩크, 사건 등)를 실시간으로 모니터링하는 React 대시보드 애플리케이션입니다.

## 주요 기능

- **채널 관리**: MediaLive 채널 추가/제거 및 상태 모니터링
- **실시간 이벤트 피드**: 스포츠 이벤트(3점슛, 덩크, 사건) 실시간 감지 및 표시
- **비디오 플레이어**: HLS 스트림 재생 지원
- **CloudWatch 로그 연동**: 이벤트 로그 조회

## 기술 스택

- React 18 + TypeScript
- Vite (빌드 도구)
- Tailwind CSS 4
- Radix UI (컴포넌트 라이브러리)
- Lucide React (아이콘)
- React Router 7

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
│   ├── components/       # UI 컴포넌트
│   │   ├── ui/          # 공통 UI 컴포넌트 (shadcn/ui)
│   │   ├── dashboard.tsx
│   │   ├── channel-card.tsx
│   │   ├── video-player.tsx
│   │   └── live-events-sidebar.tsx
│   ├── types/           # TypeScript 타입 정의
│   ├── utils/           # 유틸리티 함수
│   └── routes.ts        # 라우팅 설정
└── main.tsx
```

# Project Structure

## Root Directory Layout

```
├── .kiro/                    # Kiro configuration and steering
├── dist/                     # Production build output
├── guidelines/               # Design and development guidelines
├── lambda/                   # AWS Lambda function code
├── server/                   # Backend Node.js server
├── src/                      # Frontend source code
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
└── package.json             # Project dependencies
```

## Source Code Organization (`src/`)

```
src/
├── app/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components (shadcn/ui style)
│   │   ├── figma/          # Figma-related components
│   │   ├── dashboard.tsx   # Main dashboard component
│   │   ├── channel-card.tsx
│   │   ├── channel-detail-modal.tsx
│   │   ├── add-channel-modal.tsx
│   │   ├── video-player.tsx
│   │   ├── live-events-sidebar.tsx
│   │   ├── shorts-sidebar.tsx
│   │   ├── event-badge.tsx
│   │   ├── clip-card.tsx           # Clip display with preview/download
│   │   ├── clip-generator-button.tsx # Clip generation trigger
│   │   ├── clip-status-badge.tsx   # Clip status indicator
│   │   ├── menu-screen.tsx
│   │   └── welcome-screen.tsx
│   ├── context/            # React context providers
│   │   └── shorts-context.tsx
│   ├── types/              # TypeScript type definitions
│   │   └── events.ts       # Includes Clip, ClipStatus, CreateClipRequest types
│   ├── utils/              # Utility functions
│   │   ├── aws-api.ts      # AWS API integration
│   │   ├── aws-mock.ts     # Mock data for development
│   │   ├── event-colors.ts # Event styling utilities
│   │   └── clip-utils.ts   # Time-shift URL generation, PTS conversion
│   ├── routes.ts           # Route definitions
│   └── App.tsx             # Root application component
├── styles/                 # Global styles
│   ├── index.css           # Main stylesheet
│   ├── tailwind.css        # Tailwind imports
│   ├── theme.css           # Theme variables
│   └── fonts.css           # Font definitions
└── main.tsx                # Application entry point
```

## Component Organization

### UI Components (`src/app/components/ui/`)
Reusable, atomic UI components following shadcn/ui patterns:
- Form controls (button, input, select, checkbox, etc.)
- Layout components (card, dialog, sheet, sidebar, etc.)
- Feedback components (alert, toast, progress, etc.)
- Navigation components (tabs, menubar, breadcrumb, etc.)

### Feature Components (`src/app/components/`)
Application-specific components that compose UI components:
- `dashboard.tsx` - Main application view
- `channel-card.tsx` - MediaLive channel display
- `video-player.tsx` - HLS video playback
- `live-events-sidebar.tsx` - Real-time event feed
- `clip-card.tsx` - Clip display with thumbnail, preview, download
- `clip-generator-button.tsx` - Trigger clip generation from events
- `clip-status-badge.tsx` - Visual status indicator for clips
- Modal components for channel management

## Backend Structure (`server/`)

```
server/
├── index.js                # Express server entry point
├── package.json            # Server dependencies
└── node_modules/           # Server dependencies
```

## Lambda Functions (`lambda/`)

```
lambda/
├── index.mjs               # Main API Lambda (channels, events, clips CRUD)
├── function.zip            # Deployment package
├── api-function.zip        # API Lambda deployment package
├── policy.json             # IAM policy
├── trust-policy.json       # IAM trust policy
├── clip-generator/         # Highlight clip generation Lambda
│   ├── index.mjs           # EventBridge handler → FFmpeg → S3/DynamoDB
│   ├── function.zip        # Deployment package
│   └── package.json        # Dependencies (@aws-sdk/*)
├── edge-vod-converter/     # Lambda@Edge for VOD conversion
│   ├── index.js            # Origin Request handler (HLS VOD 변환)
│   ├── function.zip        # Deployment package
│   ├── README.md           # 배포 가이드
│   └── trust-policy.json   # Edge Lambda trust policy
└── ffmpeg-layer/           # FFmpeg Lambda Layer
    └── bin/ffmpeg          # FFmpeg 바이너리
```

### API Endpoints (lambda/index.mjs)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/channels` | 채널 목록 조회 |
| GET | `/channels/{channelId}` | 채널 상세 조회 |
| GET | `/channels/{channelId}/events` | 채널별 이벤트 목록 |
| GET | `/channels/{channelId}/clips` | 채널별 클립 목록 |
| GET | `/channels/{channelId}/thumbnail` | 채널 썸네일 |
| POST | `/clips` | 클립 생성 요청 |
| GET | `/clips` | 전체 클립 목록 |
| GET | `/clips/{clipId}` | 클립 상태 조회 |
| GET | `/clips/{clipId}/download` | 다운로드 URL 생성 |

## Naming Conventions

- **Components**: PascalCase for component files and exports (e.g., `Dashboard.tsx`, `ChannelCard.tsx`)
- **Utilities**: kebab-case for utility files (e.g., `aws-api.ts`, `event-colors.ts`)
- **Types**: PascalCase for type definitions (e.g., `MediaLiveChannel`, `SportEvent`)
- **Constants**: UPPER_SNAKE_CASE for constants

## Import Patterns

Use path alias for cleaner imports:
```typescript
import { Dashboard } from '@/app/components/dashboard';
import type { SportEvent } from '@/app/types/events';
import { getRunningChannels } from '@/app/utils/aws-api';
```

## File Colocation

- Keep related components close together
- UI components are centralized in `ui/` directory
- Feature-specific components live at the feature level
- Types are defined close to where they're used or in shared `types/` directory

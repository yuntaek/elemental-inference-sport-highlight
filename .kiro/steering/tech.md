# Technology Stack

## Build System

- **Build Tool**: Vite 6.3.5
- **Package Manager**: npm (pnpm overrides configured)
- **Language**: TypeScript with React 18.3.1

## Frontend Stack

### Core Framework
- React 18.3.1 with TypeScript
- React Router 7 for routing
- Vite for development and bundling

### UI Libraries
- **Component Library**: Radix UI (headless components)
- **Styling**: Tailwind CSS 4.1.12
- **Icons**: Lucide React
- **Additional UI**: Material-UI 7.3.5, Emotion for styled components

### Key Dependencies
- `react-hook-form` - Form management
- `date-fns` - Date manipulation
- `recharts` - Data visualization
- `embla-carousel-react` - Carousel functionality
- `react-dnd` - Drag and drop
- `sonner` - Toast notifications
- `motion` - Animations

## Backend Integration

- **AWS Services**: MediaLive, MediaPackage, CloudWatch Logs, DynamoDB, S3, CloudFront, EventBridge, Lambda@Edge
- **Streaming**: HLS video playback with Time-shift support via CloudFront
- **Clip Generation**: FFmpeg Lambda Layer (MediaConvert 대체) - HLS → MP4 직접 변환

### API Gateway Endpoints

| 환경 | API Gateway URL | Lambda |
|------|-----------------|--------|
| **Production** | `https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com` | `highlight-manager-api` |
| **Staging** | `https://s08iiuslb1.execute-api.us-west-2.amazonaws.com` | `highlight-manager-api-stage` |

### CloudFront Distributions

| 용도 | CloudFront Domain | Origin |
|------|-------------------|--------|
| **HLS Streaming** | `d2byorho3b7g5y.cloudfront.net` | MediaPackage (`c4af3793bf76b33c.mediapackage.us-west-2.amazonaws.com`) |
| **Clip Storage** | `df1kr6icfg8e8.cloudfront.net` | S3 (`hackathon8-output-video`) |

### DynamoDB Tables

| 환경 | 테이블명 | 용도 |
|------|----------|------|
| **Production** | `highlight-clips` | 클립 메타데이터 저장 |
| **Staging** | `highlight-clips-stage` | 클립 메타데이터 저장 (staging) |

### Lambda Functions

| 함수명 | 용도 | 환경변수 |
|--------|------|----------|
| `highlight-manager-api` | API 엔드포인트 (Production) | `DYNAMODB_TABLE=highlight-clips` |
| `highlight-manager-api-stage` | API 엔드포인트 (Staging) | `DYNAMODB_TABLE=highlight-clips-stage` |
| `highlight-clip-generator` | EventBridge → FFmpeg 클립 생성 (Production) | - |
| `highlight-clip-generator-stage` | EventBridge → FFmpeg 클립 생성 (Staging) | `DYNAMODB_TABLE=highlight-clips-stage`, `EVENT_DELAY_MS=40000` |

### Lambda@Edge Functions

| 함수명 | 용도 | 트리거 |
|--------|------|--------|
| `edge-vod-converter` | MediaPackage Time-shift HLS를 VOD 형식으로 변환 | CloudFront Origin Request |

### Lambda Layers

| Layer ARN | 용도 |
|-----------|------|
| `arn:aws:lambda:us-west-2:083304596944:layer:ffmpeg:1` | FFmpeg 바이너리 (HLS → MP4 변환) |

### EventBridge

- **Rule**: `rule`
- **Event Pattern**: `aws.elemental-inference` / `Clip Metadata Generated`
- **Targets**: CloudWatch Logs, `highlight-clip-generator`, `highlight-clip-generator-stage`

### Clip Generation Pipeline

```
EventBridge (스포츠 이벤트)
    ↓
highlight-clip-generator-stage Lambda
    ↓ (EVENT_DELAY_MS 대기 - Time-shift 데이터 준비)
CloudFront + Lambda@Edge (VOD 변환)
    ↓
FFmpeg (HLS → MP4 변환)
    ↓
S3 업로드 + DynamoDB 메타데이터 저장
```

**주요 설정:**
- `EVENT_DELAY_MS`: EventBridge 이벤트 수신 후 클립 생성 전 대기 시간 (기본 60초, 환경변수로 조정 가능)
- Time-shift 데이터가 MediaPackage에 준비되기까지 약 40-60초 소요
- 404 에러 발생 시 2초 간격으로 최대 3회 재시도

### S3 Buckets

- **Clip Storage**: `hackathon8-output-video` (생성된 클립 파일 저장)

## Common Commands

```bash
# Install dependencies
npm install

# Development server (frontend only)
npm run dev

# Backend server (Node.js)
npm run server

# Run both frontend and backend concurrently
npm start

# Production build
npm run build
```

## Development Server

- Frontend runs on Vite dev server (default: http://localhost:5173)
- Backend server runs separately on Node.js (see server/index.js)
- Use `npm start` to run both concurrently

## Path Aliases

- `@/` maps to `./src/` directory for cleaner imports

## Build Output

- Production builds output to `dist/` directory
- Vite handles bundling, optimization, and asset management

## Testing

- **Test Framework**: Vitest
- **Property-Based Testing**: fast-check library
- **Test Files**: `*.test.ts` colocated with source files
- **Run Tests**: `npm test` or `npx vitest --run`

## Key Types

```typescript
// Clip status lifecycle
type ClipStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Clip entity structure
interface Clip {
  id: string;
  channelId: string;
  type: EventType;
  status: ClipStatus;
  clipUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  timestamp: number;
  tags?: string[];
  error?: string;
}
```

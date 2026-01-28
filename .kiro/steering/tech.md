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

- **AWS Services**: MediaLive, CloudWatch Logs
- **API Gateway**: REST API at `https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com`
- **Streaming**: HLS video playback

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

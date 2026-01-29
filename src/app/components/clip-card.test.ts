/**
 * Property-Based Tests for ClipCard Metadata Display
 * Feature: highlight-clip-generation
 * 
 * Tests validate:
 * - Property 6: 클립 메타데이터 표시 완전성
 * 
 * Validates: Requirements 6.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Clip, EventType, ClipStatus } from '@/app/types/events';
import { extractClipMetadata } from './clip-card';

// Arbitrary generators for Clip types
const eventTypeArb = fc.constantFrom<EventType>(
  'three-pointer',
  'dunk',
  'incident',
  'default'
);

const clipStatusArb = fc.constantFrom<ClipStatus>(
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

// Generator for valid Clip objects
const clipArb = fc.record<Clip>({
  id: fc.uuid(),
  channelId: fc.uuid(),
  eventId: fc.uuid(),
  type: eventTypeArb,
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  startPts: fc.integer({ min: 0, max: 1000000 }),
  endPts: fc.integer({ min: 1, max: 2000000 }),
  timescale: fc.integer({ min: 1, max: 90000 }),
  duration: fc.integer({ min: 1, max: 3600 }),
  timestamp: fc.integer({ min: Date.now() - 24 * 60 * 60 * 1000, max: Date.now() }),
  status: clipStatusArb,
  error: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  clipUrl: fc.option(fc.webUrl(), { nil: undefined }),
  thumbnailUrl: fc.option(fc.webUrl(), { nil: undefined }),
  createdAt: fc.integer({ min: Date.now() - 24 * 60 * 60 * 1000, max: Date.now() }),
  updatedAt: fc.integer({ min: Date.now() - 24 * 60 * 60 * 1000, max: Date.now() }),
});

// Generator for COMPLETED clips only
const completedClipArb = clipArb.map((clip) => ({
  ...clip,
  status: 'COMPLETED' as ClipStatus,
  clipUrl: `https://example.com/clips/${clip.id}.mp4`,
}));

describe('ClipCard', () => {
  /**
   * Feature: highlight-clip-generation, Property 6: 클립 메타데이터 표시 완전성
   * *For any* COMPLETED 상태의 클립에 대해, 미리보기 시 이벤트 타입, 시간, 
   * 길이 메타데이터가 모두 표시되어야 한다.
   * 
   * Validates: Requirements 6.2
   */
  describe('Property 6: 클립 메타데이터 표시 완전성', () => {
    it('should extract all required metadata (eventType, time, duration) for any COMPLETED clip', () => {
      fc.assert(
        fc.property(completedClipArb, (clip) => {
          const metadata = extractClipMetadata(clip);

          // 이벤트 타입이 존재하고 비어있지 않아야 함
          expect(metadata.eventType).toBeDefined();
          expect(typeof metadata.eventType).toBe('string');
          expect(metadata.eventType.length).toBeGreaterThan(0);
          expect(['three-pointer', 'dunk', 'incident', 'default']).toContain(metadata.eventType);

          // 시간이 존재하고 유효한 형식이어야 함
          expect(metadata.time).toBeDefined();
          expect(typeof metadata.time).toBe('string');
          expect(metadata.time.length).toBeGreaterThan(0);
          // HH:MM:SS 형식 검증
          expect(metadata.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);

          // 길이가 존재하고 유효한 형식이어야 함
          expect(metadata.duration).toBeDefined();
          expect(typeof metadata.duration).toBe('string');
          expect(metadata.duration.length).toBeGreaterThan(0);
          // 초 또는 분:초 형식 검증 (예: "30s" 또는 "1m 30s")
          expect(metadata.duration).toMatch(/^(\d+m\s)?\d+s$/);
        }),
        { numRuns: 100 }
      );
    });

    it('should extract metadata for any clip regardless of status', () => {
      fc.assert(
        fc.property(clipArb, (clip) => {
          const metadata = extractClipMetadata(clip);

          // 모든 상태의 클립에서 메타데이터 추출이 가능해야 함
          expect(metadata.eventType).toBeDefined();
          expect(metadata.time).toBeDefined();
          expect(metadata.duration).toBeDefined();

          // 메타데이터가 원본 클립 데이터와 일치해야 함
          expect(metadata.eventType).toBe(clip.type);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve eventType exactly as provided in the clip', () => {
      fc.assert(
        fc.property(clipArb, (clip) => {
          const metadata = extractClipMetadata(clip);
          
          // eventType은 원본과 정확히 일치해야 함
          expect(metadata.eventType).toBe(clip.type);
        }),
        { numRuns: 100 }
      );
    });

    it('should format duration consistently for any positive duration value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 7200 }), // 1초 ~ 2시간
          (duration) => {
            const clip: Clip = {
              id: 'test-id',
              channelId: 'channel-id',
              eventId: 'event-id',
              type: 'dunk',
              tags: [],
              startPts: 0,
              endPts: 90000,
              timescale: 90000,
              duration,
              timestamp: Date.now(),
              status: 'COMPLETED',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };

            const metadata = extractClipMetadata(clip);

            // duration 문자열이 유효해야 함
            expect(metadata.duration).toBeDefined();
            expect(metadata.duration.length).toBeGreaterThan(0);

            // 형식이 올바른지 확인 (Xs 또는 Xm Ys)
            if (duration < 60) {
              expect(metadata.duration).toBe(`${duration}s`);
            } else {
              const minutes = Math.floor(duration / 60);
              const seconds = duration % 60;
              expect(metadata.duration).toBe(`${minutes}m ${seconds}s`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

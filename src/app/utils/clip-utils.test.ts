/**
 * Property-Based Tests for Time-shift URL Generation
 * Feature: highlight-clip-generation
 * 
 * Tests validate:
 * - Property 3: Time-shift URL 형식 정확성
 * - Property 4: Time-shift 윈도우 범위 검증
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ptsToSeconds,
  timestampToISO8601,
  calculateClipTimeRange,
  generateTimeShiftUrl,
  validateTimeShiftWindow,
  calculateClipDuration,
} from './clip-utils';

// ISO 8601 형식 검증 정규식
const ISO8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

describe('clip-utils', () => {
  /**
   * Feature: highlight-clip-generation, Property 3: Time-shift URL 형식 정확성
   * *For any* 유효한 timestamp와 PTS 값에 대해, 생성된 Time-shift URL은 
   * ISO 8601 형식의 start/end 파라미터를 포함해야 하며, 
   * start는 end보다 이전 시점이어야 한다.
   * 
   * Validates: Requirements 2.1, 2.2
   */
  describe('Property 3: Time-shift URL 형식 정확성', () => {
    it('should generate Time-shift URL with valid ISO 8601 start/end parameters where start < end', () => {
      fc.assert(
        fc.property(
          // 유효한 base URL
          fc.webUrl(),
          // 이벤트 timestamp (과거 24시간 이내)
          fc.integer({ min: Date.now() - 23 * 60 * 60 * 1000, max: Date.now() }),
          // startPts (양수)
          fc.integer({ min: 0, max: 1000000 }),
          // duration in PTS units (최소 1초 이상)
          fc.integer({ min: 1, max: 3600 }),
          // timescale (양수)
          fc.integer({ min: 1, max: 90000 }),
          (baseUrl, eventTimestamp, startPts, durationPts, timescale) => {
            const endPts = startPts + durationPts * timescale;

            const result = generateTimeShiftUrl({
              baseUrl,
              eventTimestamp,
              startPts,
              endPts,
              timescale,
            });

            // URL이 생성되어야 함
            expect(result.url).toBeDefined();
            expect(typeof result.url).toBe('string');

            // start/end 파라미터가 ISO 8601 형식이어야 함
            expect(result.startTime).toMatch(ISO8601_REGEX);
            expect(result.endTime).toMatch(ISO8601_REGEX);

            // start는 end보다 이전이어야 함
            const startDate = new Date(result.startTime);
            const endDate = new Date(result.endTime);
            expect(startDate.getTime()).toBeLessThan(endDate.getTime());

            // URL에 start/end 파라미터가 포함되어야 함
            const url = new URL(result.url);
            expect(url.searchParams.get('start')).toBe(result.startTime);
            expect(url.searchParams.get('end')).toBe(result.endTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce ISO 8601 formatted timestamps for any valid input', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
          (timestamp) => {
            const result = timestampToISO8601(timestamp);
            expect(result).toMatch(ISO8601_REGEX);
            
            // 변환된 값이 원본 timestamp와 일치해야 함
            const parsed = new Date(result).getTime();
            expect(parsed).toBe(timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate clip time range with start always before end', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: Date.now() - 24 * 60 * 60 * 1000, max: Date.now() }),
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 1, max: 3600 }),
          fc.integer({ min: 1, max: 90000 }),
          (eventTimestamp, startPts, durationPts, timescale) => {
            const endPts = startPts + durationPts * timescale;

            const result = calculateClipTimeRange(
              eventTimestamp,
              startPts,
              endPts,
              timescale
            );

            // 결과가 ISO 8601 형식이어야 함
            expect(result.startTime).toMatch(ISO8601_REGEX);
            expect(result.endTime).toMatch(ISO8601_REGEX);

            // start < end
            const startDate = new Date(result.startTime);
            const endDate = new Date(result.endTime);
            expect(startDate.getTime()).toBeLessThan(endDate.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: highlight-clip-generation, Property 4: Time-shift 윈도우 범위 검증
   * *For any* 이벤트 timestamp가 현재 시점으로부터 24시간 이전인 경우, 
   * 클립 생성 요청은 에러를 반환해야 한다.
   * 
   * Validates: Requirements 2.3
   */
  describe('Property 4: Time-shift 윈도우 범위 검증', () => {
    it('should reject events outside the 24-hour time-shift window', () => {
      const WINDOW_MS = 24 * 60 * 60 * 1000;

      fc.assert(
        fc.property(
          // 24시간 이전의 timestamp (윈도우 밖)
          fc.integer({ 
            min: Date.now() - 365 * 24 * 60 * 60 * 1000, 
            max: Date.now() - WINDOW_MS - 1000 
          }),
          (oldTimestamp) => {
            const result = validateTimeShiftWindow(oldTimestamp);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('outside time-shift window');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept events within the 24-hour time-shift window', () => {
      const WINDOW_MS = 24 * 60 * 60 * 1000;

      fc.assert(
        fc.property(
          // 24시간 이내의 timestamp (윈도우 안)
          fc.integer({ 
            min: Date.now() - WINDOW_MS + 1000, 
            max: Date.now() - 1000 
          }),
          (recentTimestamp) => {
            const result = validateTimeShiftWindow(recentTimestamp);
            
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject future timestamps', () => {
      fc.assert(
        fc.property(
          // 미래의 timestamp
          fc.integer({ 
            min: Date.now() + 1000, 
            max: Date.now() + 365 * 24 * 60 * 60 * 1000 
          }),
          (futureTimestamp) => {
            const result = validateTimeShiftWindow(futureTimestamp);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('future');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Unit tests for edge cases and specific examples
  describe('Unit Tests', () => {
    describe('ptsToSeconds', () => {
      it('should convert PTS to seconds correctly', () => {
        expect(ptsToSeconds(90000, 90000)).toBe(1);
        expect(ptsToSeconds(180000, 90000)).toBe(2);
        expect(ptsToSeconds(45000, 90000)).toBe(0.5);
      });

      it('should throw error for invalid timescale', () => {
        expect(() => ptsToSeconds(90000, 0)).toThrow('Timescale must be a positive number');
        expect(() => ptsToSeconds(90000, -1)).toThrow('Timescale must be a positive number');
      });
    });

    describe('calculateClipDuration', () => {
      it('should calculate duration correctly', () => {
        // 90000 timescale, 1 second duration
        expect(calculateClipDuration(0, 90000, 90000)).toBe(1);
        // 90000 timescale, 30 seconds duration
        expect(calculateClipDuration(0, 2700000, 90000)).toBe(30);
      });
    });
  });
});

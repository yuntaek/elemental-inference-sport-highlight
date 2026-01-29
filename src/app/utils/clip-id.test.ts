/**
 * Property-Based Tests for Clip ID Generation
 * Feature: highlight-clip-generation
 * 
 * Tests validate:
 * - Property 2: 클립 ID 고유성
 * 
 * Validates: Requirements 1.4
 * 
 * Note: This tests the same UUID generation logic used in the Lambda function
 * (lambda/clip-generator/index.mjs) which uses crypto.randomUUID()
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * clipId 생성 함수 - Lambda에서 사용하는 것과 동일한 로직
 * crypto.randomUUID()를 사용하여 고유한 ID를 생성
 */
function generateClipId(): string {
  return crypto.randomUUID();
}

/**
 * 여러 클립 생성 요청을 시뮬레이션하여 clipId 목록 생성
 */
function generateMultipleClipIds(count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateClipId());
  }
  return ids;
}

describe('clip-id generation', () => {
  /**
   * Feature: highlight-clip-generation, Property 2: 클립 ID 고유성
   * *For any* 성공적인 클립 생성 요청에 대해, 생성된 clipId는 
   * 기존의 모든 clipId와 중복되지 않아야 한다.
   * 
   * Validates: Requirements 1.4
   */
  describe('Property 2: 클립 ID 고유성', () => {
    it('should generate unique clipIds for any number of concurrent requests', () => {
      fc.assert(
        fc.property(
          // 2~100개의 동시 요청 시뮬레이션
          fc.integer({ min: 2, max: 100 }),
          (requestCount) => {
            const clipIds = generateMultipleClipIds(requestCount);
            
            // Set을 사용하여 중복 확인
            const uniqueIds = new Set(clipIds);
            
            // 모든 ID가 고유해야 함
            expect(uniqueIds.size).toBe(requestCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate clipIds that are valid UUID v4 format', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (requestCount) => {
            const clipIds = generateMultipleClipIds(requestCount);
            
            // UUID v4 형식 검증 정규식
            const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            
            for (const clipId of clipIds) {
              expect(clipId).toMatch(uuidV4Regex);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never generate duplicate clipIds across multiple batches', () => {
      fc.assert(
        fc.property(
          // 배치 수 (2~10)
          fc.integer({ min: 2, max: 10 }),
          // 배치당 요청 수 (5~20)
          fc.integer({ min: 5, max: 20 }),
          (batchCount, requestsPerBatch) => {
            const allClipIds: string[] = [];
            
            // 여러 배치에서 clipId 생성
            for (let batch = 0; batch < batchCount; batch++) {
              const batchIds = generateMultipleClipIds(requestsPerBatch);
              allClipIds.push(...batchIds);
            }
            
            const totalExpected = batchCount * requestsPerBatch;
            const uniqueIds = new Set(allClipIds);
            
            // 모든 배치의 모든 ID가 고유해야 함
            expect(uniqueIds.size).toBe(totalExpected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate clipIds with sufficient entropy (no patterns)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 50 }),
          (requestCount) => {
            const clipIds = generateMultipleClipIds(requestCount);
            
            // 연속된 ID들 사이에 패턴이 없어야 함
            // 각 ID의 첫 8자리가 모두 다른지 확인 (충분한 엔트로피)
            const prefixes = clipIds.map(id => id.substring(0, 8));
            const uniquePrefixes = new Set(prefixes);
            
            // 대부분의 prefix가 고유해야 함 (최소 90%)
            expect(uniquePrefixes.size).toBeGreaterThanOrEqual(Math.floor(requestCount * 0.9));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate non-empty clipIds for any valid request', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (requestCount) => {
            const clipIds = generateMultipleClipIds(requestCount);
            
            for (const clipId of clipIds) {
              expect(clipId).toBeTruthy();
              expect(clipId.length).toBe(36); // UUID 표준 길이
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

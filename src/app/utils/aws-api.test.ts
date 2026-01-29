/**
 * Property-Based Tests for API Client Functions
 * Feature: highlight-clip-generation
 * 
 * Tests validate:
 * - Property 1: 클립 생성 요청 파라미터 완전성
 * 
 * Validates: Requirements 1.1, 1.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateCreateClipRequest } from './aws-api';
import type { CreateClipRequest } from '@/app/types/events';

// 유효한 CreateClipRequest 생성을 위한 arbitrary
const validCreateClipRequestArb = fc.record({
  channelId: fc.string({ minLength: 1 }),
  eventId: fc.string({ minLength: 1 }),
  startPts: fc.integer({ min: 0 }),
  endPts: fc.integer({ min: 1 }),
  timescale: fc.integer({ min: 1 }),
  timestamp: fc.integer({ min: 0 }),
  tags: fc.option(fc.array(fc.string()), { nil: undefined }),
});

// 필수 필드 목록
const requiredFields: (keyof CreateClipRequest)[] = [
  'channelId',
  'eventId',
  'startPts',
  'endPts',
  'timescale',
  'timestamp',
];

describe('aws-api', () => {
  /**
   * Feature: highlight-clip-generation, Property 1: 클립 생성 요청 파라미터 완전성
   * *For any* 클립 생성 요청, 필수 파라미터(startPts, endPts, channelId, timestamp)가 
   * 모두 포함된 경우에만 요청이 성공하고, 하나라도 누락된 경우 에러를 반환해야 한다.
   * 
   * Validates: Requirements 1.1, 1.3
   */
  describe('Property 1: 클립 생성 요청 파라미터 완전성', () => {
    it('should validate successfully when all required parameters are present', () => {
      fc.assert(
        fc.property(validCreateClipRequestArb, (request) => {
          const result = validateCreateClipRequest(request);
          
          expect(result.valid).toBe(true);
          expect(result.missing).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should fail validation when any single required parameter is missing', () => {
      fc.assert(
        fc.property(
          validCreateClipRequestArb,
          fc.constantFrom(...requiredFields),
          (request, fieldToRemove) => {
            // 하나의 필수 필드를 제거
            const incompleteRequest = { ...request };
            delete (incompleteRequest as Record<string, unknown>)[fieldToRemove];
            
            const result = validateCreateClipRequest(incompleteRequest);
            
            expect(result.valid).toBe(false);
            expect(result.missing).toContain(fieldToRemove);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should report all missing parameters when multiple are absent', () => {
      fc.assert(
        fc.property(
          validCreateClipRequestArb,
          // 1개 이상의 필드를 랜덤하게 선택
          fc.subarray(requiredFields, { minLength: 1 }),
          (request, fieldsToRemove) => {
            // 선택된 필드들을 제거
            const incompleteRequest = { ...request };
            for (const field of fieldsToRemove) {
              delete (incompleteRequest as Record<string, unknown>)[field];
            }
            
            const result = validateCreateClipRequest(incompleteRequest);
            
            expect(result.valid).toBe(false);
            expect(result.missing.length).toBe(fieldsToRemove.length);
            
            // 모든 제거된 필드가 missing에 포함되어야 함
            for (const field of fieldsToRemove) {
              expect(result.missing).toContain(field);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should treat null values as missing parameters', () => {
      fc.assert(
        fc.property(
          validCreateClipRequestArb,
          fc.constantFrom(...requiredFields),
          (request, fieldToNull) => {
            // 하나의 필수 필드를 null로 설정
            const requestWithNull = { 
              ...request, 
              [fieldToNull]: null 
            } as Partial<CreateClipRequest>;
            
            const result = validateCreateClipRequest(requestWithNull);
            
            expect(result.valid).toBe(false);
            expect(result.missing).toContain(fieldToNull);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept optional tags parameter regardless of presence', () => {
      fc.assert(
        fc.property(
          validCreateClipRequestArb,
          fc.boolean(),
          (request, includeTags) => {
            const testRequest = { ...request };
            if (!includeTags) {
              delete testRequest.tags;
            }
            
            const result = validateCreateClipRequest(testRequest);
            
            // tags는 선택적이므로 유효성에 영향을 주지 않아야 함
            expect(result.valid).toBe(true);
            expect(result.missing).not.toContain('tags');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

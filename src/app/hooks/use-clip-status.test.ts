/**
 * Property-Based Tests for Clip Status Management
 * Feature: highlight-clip-generation
 * 
 * Tests validate:
 * - Property 5: 클립 상태 전이 일관성
 * 
 * Validates: Requirements 1.2, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ClipStatus } from '@/app/types/events';

/**
 * Valid state transitions for clip status
 * PENDING → PROCESSING → COMPLETED
 * PENDING → PROCESSING → FAILED
 * 
 * No reverse transitions allowed
 */
const VALID_TRANSITIONS: Record<ClipStatus, ClipStatus[]> = {
  PENDING: ['PROCESSING'],
  PROCESSING: ['COMPLETED', 'FAILED'],
  COMPLETED: [], // Terminal state
  FAILED: [], // Terminal state
};

const ALL_STATUSES: ClipStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];

/**
 * Validates if a state transition is valid
 */
function isValidTransition(from: ClipStatus, to: ClipStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Validates a sequence of state transitions
 */
function validateTransitionSequence(sequence: ClipStatus[]): { 
  valid: boolean; 
  invalidTransition?: { from: ClipStatus; to: ClipStatus; index: number } 
} {
  if (sequence.length < 2) {
    return { valid: true };
  }

  for (let i = 0; i < sequence.length - 1; i++) {
    const from = sequence[i];
    const to = sequence[i + 1];
    
    if (!isValidTransition(from, to)) {
      return { 
        valid: false, 
        invalidTransition: { from, to, index: i } 
      };
    }
  }

  return { valid: true };
}

/**
 * Generates a valid state transition sequence starting from PENDING
 */
function generateValidSequence(): ClipStatus[] {
  const sequence: ClipStatus[] = ['PENDING'];
  let current: ClipStatus = 'PENDING';

  while (VALID_TRANSITIONS[current].length > 0) {
    const nextOptions = VALID_TRANSITIONS[current];
    const next = nextOptions[Math.floor(Math.random() * nextOptions.length)];
    sequence.push(next);
    current = next;
  }

  return sequence;
}

describe('Clip Status State Machine', () => {
  /**
   * Feature: highlight-clip-generation, Property 5: 클립 상태 전이 일관성
   * *For any* 클립에 대해, 상태는 PENDING → PROCESSING → COMPLETED 또는 
   * PENDING → PROCESSING → FAILED 순서로만 전이되어야 하며, 
   * 역방향 전이는 불가능해야 한다.
   * 
   * Validates: Requirements 1.2, 3.2, 3.3, 3.4
   */
  describe('Property 5: 클립 상태 전이 일관성', () => {
    it('should only allow forward transitions in the state machine', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_STATUSES),
          fc.constantFrom(...ALL_STATUSES),
          (fromStatus, toStatus) => {
            const isValid = isValidTransition(fromStatus, toStatus);
            
            // PENDING can only go to PROCESSING
            if (fromStatus === 'PENDING') {
              expect(isValid).toBe(toStatus === 'PROCESSING');
            }
            
            // PROCESSING can only go to COMPLETED or FAILED
            if (fromStatus === 'PROCESSING') {
              expect(isValid).toBe(toStatus === 'COMPLETED' || toStatus === 'FAILED');
            }
            
            // COMPLETED is terminal - no transitions allowed
            if (fromStatus === 'COMPLETED') {
              expect(isValid).toBe(false);
            }
            
            // FAILED is terminal - no transitions allowed
            if (fromStatus === 'FAILED') {
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject reverse transitions', () => {
      // Define reverse transitions that should be invalid
      const reverseTransitions: [ClipStatus, ClipStatus][] = [
        ['PROCESSING', 'PENDING'],
        ['COMPLETED', 'PROCESSING'],
        ['COMPLETED', 'PENDING'],
        ['FAILED', 'PROCESSING'],
        ['FAILED', 'PENDING'],
        ['FAILED', 'COMPLETED'],
        ['COMPLETED', 'FAILED'],
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...reverseTransitions),
          ([from, to]) => {
            const isValid = isValidTransition(from, to);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate complete transition sequences', () => {
      // Valid sequences
      const validSequences: ClipStatus[][] = [
        ['PENDING', 'PROCESSING', 'COMPLETED'],
        ['PENDING', 'PROCESSING', 'FAILED'],
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...validSequences),
          (sequence) => {
            const result = validateTransitionSequence(sequence);
            expect(result.valid).toBe(true);
            expect(result.invalidTransition).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid transition sequences', () => {
      // Invalid sequences with reverse or skip transitions
      const invalidSequences: ClipStatus[][] = [
        ['PENDING', 'COMPLETED'], // Skip PROCESSING
        ['PENDING', 'FAILED'], // Skip PROCESSING
        ['PROCESSING', 'PENDING'], // Reverse
        ['COMPLETED', 'PENDING'], // Reverse from terminal
        ['FAILED', 'PENDING'], // Reverse from terminal
        ['COMPLETED', 'PROCESSING'], // Reverse from terminal
        ['FAILED', 'PROCESSING'], // Reverse from terminal
        ['PENDING', 'PROCESSING', 'PENDING'], // Cycle back
        ['PENDING', 'PROCESSING', 'COMPLETED', 'PROCESSING'], // Continue after terminal
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...invalidSequences),
          (sequence) => {
            const result = validateTransitionSequence(sequence);
            expect(result.valid).toBe(false);
            expect(result.invalidTransition).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always start from PENDING state for new clips', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          () => {
            // Generate multiple valid sequences
            const sequence = generateValidSequence();
            
            // First state must always be PENDING
            expect(sequence[0]).toBe('PENDING');
            
            // Sequence must be valid
            const result = validateTransitionSequence(sequence);
            expect(result.valid).toBe(true);
            
            // Must end in a terminal state
            const lastState = sequence[sequence.length - 1];
            expect(['COMPLETED', 'FAILED']).toContain(lastState);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure terminal states have no outgoing transitions', () => {
      const terminalStates: ClipStatus[] = ['COMPLETED', 'FAILED'];

      fc.assert(
        fc.property(
          fc.constantFrom(...terminalStates),
          fc.constantFrom(...ALL_STATUSES),
          (terminalState, anyState) => {
            const isValid = isValidTransition(terminalState, anyState);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// Export functions for potential reuse
export { isValidTransition, validateTransitionSequence, VALID_TRANSITIONS };

import { describe, it, expect } from 'vitest';
import {
  initRecoveryWorkflow,
  transitionWorkflowState,
} from '@recoverflow/core';
import { generateSyntheticPayments } from '@recoverflow/core';
import { InvalidTransitionError } from '@recoverflow/core';
import { FixedClock } from '@recoverflow/core';

describe('State Machine — Invariant & Property Tests', () => {
  const payment = generateSyntheticPayments({ seed: 42, totalRecords: 10 })[0];
  const clock = new FixedClock('2026-03-01T10:00:00Z');

  it('Property 1: Legal transition sequence executes deterministically without exception', () => {
    const wf = initRecoveryWorkflow(payment, { clock });
    expect(wf.currentState).toBe('DETECTED');

    transitionWorkflowState(wf, 'DIAGNOSED', 'system', 'DIAGNOSIS', {}, { clock });
    expect(wf.currentState).toBe('DIAGNOSED');

    transitionWorkflowState(wf, 'ELIGIBILITY_CHECKED', 'system', 'SAFETY_PASSED', {}, { clock });
    expect(wf.currentState).toBe('ELIGIBILITY_CHECKED');

    transitionWorkflowState(wf, 'SCHEDULED', 'system', 'OUTSIDE_QUIET_HOURS', {}, { clock });
    expect(wf.currentState).toBe('SCHEDULED');

    transitionWorkflowState(wf, 'EXECUTING', 'system', 'DISPATCHED', {}, { clock });
    expect(wf.currentState).toBe('EXECUTING');

    transitionWorkflowState(wf, 'OUTCOME_OBSERVED', 'payment_provider', 'CAPTURED', {}, { clock });
    expect(wf.currentState).toBe('OUTCOME_OBSERVED');

    transitionWorkflowState(wf, 'RECOVERED', 'system', 'SETTLED', {}, { clock });
    expect(wf.currentState).toBe('RECOVERED');
    expect(wf.history.length).toBe(7);
  });

  it('Property 2: Any illegal state skip throws typed InvalidTransitionError', () => {
    const wf = initRecoveryWorkflow(payment, { clock });

    // Cannot jump directly from DETECTED to RECOVERED or EXECUTING
    expect(() =>
      transitionWorkflowState(wf, 'RECOVERED', 'system', 'CHEAT', {}, { clock }),
    ).toThrow(InvalidTransitionError);

    expect(() =>
      transitionWorkflowState(wf, 'EXECUTING', 'system', 'CHEAT', {}, { clock }),
    ).toThrow(InvalidTransitionError);
  });

  it('Property 3: Terminal states RECOVERED and STOPPED permit zero subsequent transitions', () => {
    const wf1 = initRecoveryWorkflow(payment, { clock });
    transitionWorkflowState(wf1, 'STOPPED', 'system', 'SAFETY_OPT_OUT', {}, { clock });

    expect(() =>
      transitionWorkflowState(wf1, 'SCHEDULED', 'system', 'RESUME', {}, { clock }),
    ).toThrow(InvalidTransitionError);
  });
});

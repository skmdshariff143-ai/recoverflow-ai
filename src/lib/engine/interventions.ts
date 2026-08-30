/**
 * RecoverFlow AI — Intervention Type Selector.
 *
 * Maps failure categories to recommended recovery interventions:
 *  - 'retry': Pure gateway retry (for infrastructure downtime / network degradation / duplicate collisions).
 *  - 'reminder': Customer communication only (for expired cards / broken payment promises requiring customer action).
 *  - 'both': Gateway retry accompanied by customer notification (for balance/mandate/auth issues).
 *  - 'none': Non-recoverable categories.
 */

import type { FailureCategory, InterventionType } from '@/types';

export function selectIntervention(category: FailureCategory): InterventionType {
  switch (category) {
    case 'bank_downtime':
    case 'gateway_degradation':
    case 'duplicate_attempt':
      return 'retry';

    case 'broken_promise_to_pay':
    case 'expired_card':
      return 'reminder';

    case 'auth_failure':
    case 'insufficient_funds':
    case 'invalid_mandate':
      return 'both';

    case 'permanent_account_closure':
    case 'customer_cancellation':
    default:
      return 'none';
  }
}

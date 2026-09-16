/**
 * PayBack AI — Domain & Application Error Hierarchy.
 *
 * Provides typed, structured error classes across the recovery lifecycle.
 * Maps cleanly to API response codes without leaking internal stack traces or secrets.
 */

export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly isDomainError = true;

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends DomainError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class SafetyViolationError extends DomainError {
  readonly statusCode = 422;
  readonly code = 'SAFETY_VIOLATION_ERROR';
}

export class InvalidTransitionError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'INVALID_TRANSITION_ERROR';
}

export class IdempotencyConflictError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'IDEMPOTENCY_CONFLICT_ERROR';
}

export class ProviderTimeoutError extends DomainError {
  readonly statusCode = 504;
  readonly code = 'PROVIDER_TIMEOUT_ERROR';
}

export class ProviderRejectedError extends DomainError {
  readonly statusCode = 502;
  readonly code = 'PROVIDER_REJECTED_ERROR';
}

export class ApprovalRequiredError extends DomainError {
  readonly statusCode = 403;
  readonly code = 'APPROVAL_REQUIRED_ERROR';
}

export class FinancialIntegrityError extends DomainError {
  readonly statusCode = 400;
  readonly code = 'FINANCIAL_INTEGRITY_ERROR';
}

export class PersistenceError extends DomainError {
  readonly statusCode = 500;
  readonly code = 'PERSISTENCE_ERROR';
}

/**
 * Global HTTP response error formatter.
 */
export function formatErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof DomainError) {
    return {
      status: error.statusCode,
      body: error.toJSON(),
    };
  }

  // Sanitize unexpected internal exceptions
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
        statusCode: 500,
      },
    },
  };
}

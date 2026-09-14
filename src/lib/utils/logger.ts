/**
 * PayBack AI — Structured Financial & Diagnostic Logger.
 *
 * Emits structured JSON log entries with mandatory correlation IDs and PII scrubbing.
 */

import { redactSensitivePatterns } from './sanitizeProviderError';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  correlationId?: string;
  workflowId?: string;
  paymentId?: string;
  idempotencyKey?: string;
  stage?: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  constructor(private serviceName: string = 'payback-ai-engine') {}

  private emit(level: LogLevel, message: string, context: LogContext = {}): void {
    const cleanMessage = redactSensitivePatterns(message);
    const sanitizedContext: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(context)) {
      if (typeof v === 'string') {
        sanitizedContext[k] = redactSensitivePatterns(v);
      } else {
        sanitizedContext[k] = v;
      }
    }

    const payload = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message: cleanMessage,
      ...sanitizedContext,
    };

    // Output formatted JSON
    if (level === 'ERROR') {
      console.error(JSON.stringify(payload));
    } else if (level === 'WARN') {
      console.warn(JSON.stringify(payload));
    } else {
      console.log(JSON.stringify(payload));
    }
  }

  info(message: string, context?: LogContext): void {
    this.emit('INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit('WARN', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.emit('ERROR', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.emit('DEBUG', message, context);
  }
}

export const logger = new StructuredLogger();

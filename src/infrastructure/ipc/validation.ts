/**
 * Input Validation Framework for IPC Boundary
 * All user-provided data must pass through these validators before reaching DB or business logic.
 */

/** Sanitize a string: remove null bytes, enforce max length, trim whitespace */
export function sanitizeString(input: unknown, maxLength: number = 255): string {
  if (typeof input !== 'string') {
    throw new Error(`Expected string, got ${typeof input}`);
  }
  // Remove null bytes (SQL injection vector)
  const cleaned = input.replace(/\0/g, '').slice(0, maxLength);
  return cleaned.trim();
}

/** Validate a string is non-empty after sanitization */
export function validateNonEmptyString(input: unknown, fieldName: string, maxLength?: number): string {
  const cleaned = sanitizeString(input, maxLength);
  if (cleaned.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  return cleaned;
}

/** Validate a positive integer */
export function validatePositiveInt(input: unknown, fieldName: string = 'id'): number {
  const num = Number(input);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`${fieldName} must be a non-negative integer, got ${input}`);
  }
  return num;
}

/** Validate an object has required string fields */
export function validateObject(input: unknown, fields: Record<string, { required?: boolean; maxLength?: number }>): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Expected an object');
  }
  const result: Record<string, unknown> = {};
  for (const [key, opts] of Object.entries(fields)) {
    const value = (input as Record<string, unknown>)[key];
    if (opts.required && (value === undefined || value === null || value === '')) {
      throw new Error(`${key} is required`);
    }
    if (typeof value === 'string') {
      result[key] = opts.maxLength ? sanitizeString(value, opts.maxLength as number) : sanitizeString(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Validate a whitelist of known table names (prevents table injection) */
export function validateTableName(input: unknown, allowedTables: string[]): string {
  const name = sanitizeString(input, 64);
  if (!allowedTables.includes(name)) {
    throw new Error(`Invalid table name: ${name}`);
  }
  return name;
}

/** Validate a whitelist of known column names */
export function validateColumnName(input: unknown, allowedColumns: string[]): string {
  const name = sanitizeString(input, 64);
  if (!allowedColumns.includes(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
  return name;
}

/** Wrap an IPC handler with try-catch and input validation */
export function safeHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => unknown,
  ...argValidators: ((arg: unknown) => unknown)[]
) {
  return async (...args: TArgs) => {
    try {
      // Validate each argument if a validator is provided
      const validatedArgs = argValidators.map((validator, i) => {
        if (i < args.length) {
          return validator(args[i]);
        }
        return args[i];
      });
      return handler(...validatedArgs as TArgs);
    } catch (error: any) {
      console.error('[DeskFlow] IPC handler error:', error?.message || error);
      throw error;
    }
  };
}

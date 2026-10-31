import type { ApiErrorResponse, ApiErrorDetail } from '@rumahkita/contracts';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly error: string;
  public readonly errors: ApiErrorDetail[];
  public readonly details: Array<{ field?: string; issue: string }>;
  public readonly timestamp?: string;
  public readonly path?: string;

  constructor(payload: ApiErrorResponse) {
    const primaryMessage = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'Terjadi kesalahan pada sistem';
    super(primaryMessage);
    this.name = 'ApiClientError';
    this.statusCode = payload.statusCode || 500;
    this.error = payload.error || 'Internal Error';
    this.errors = payload.errors || [];
    this.details = (payload as any).details || [];
    this.timestamp = payload.timestamp;
    this.path = payload.path;
  }

  /**
   * Helper to retrieve field-specific error message for React Hook Form integration
   */
  public getFieldError(fieldName: string): string | undefined {
    const foundError = this.errors.find((e) => e.field === fieldName);
    if (foundError) return foundError.message;
    const foundDetail = this.details.find((d) => d.field === fieldName);
    return foundDetail?.issue;
  }
}

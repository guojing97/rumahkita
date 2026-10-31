import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClientError } from '../lib/api-client.ts';

describe('Web API Client & Error Envelope Tests', () => {
  it('correctly parses structured API error envelopes', () => {
    const errorPayload = {
      success: false as const,
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: 'Validation failed',
      errors: [
        { field: 'nominal', message: 'Nominal harus lebih dari 0' },
        { field: 'categoryId', message: 'Kategori pengeluaran wajib dipilih' },
      ],
      path: '/api/v1/expenses',
      timestamp: '2026-10-27T18:00:00.000Z',
    };

    const clientError = new ApiClientError(errorPayload);

    assert.equal(clientError.statusCode, 422);
    assert.equal(clientError.error, 'Unprocessable Entity');
    assert.equal(clientError.message, 'Validation failed');
    assert.equal(clientError.getFieldError('nominal'), 'Nominal harus lebih dari 0');
    assert.equal(clientError.getFieldError('categoryId'), 'Kategori pengeluaran wajib dipilih');
    assert.equal(clientError.getFieldError('notes'), undefined);
  });

  it('handles array message formats seamlessly', () => {
    const errorPayload = {
      success: false as const,
      statusCode: 400,
      error: 'Bad Request',
      message: ['Email tidak valid', 'Password terlalu pendek'],
    };

    const clientError = new ApiClientError(errorPayload);

    assert.equal(clientError.statusCode, 400);
    assert.equal(clientError.message, 'Email tidak valid, Password terlalu pendek');
  });

  it('handles details fallback when errors array is missing', () => {
    const errorPayload = {
      success: false as const,
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation error',
      details: [{ field: 'amount', issue: 'nominal must be greater than 0' }],
    };

    const clientError = new ApiClientError(errorPayload as any);
    assert.equal(clientError.getFieldError('amount'), 'nominal must be greater than 0');
  });
});

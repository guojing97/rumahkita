import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: string | string[] = 'Terjadi kesalahan pada server';
    let details: Array<{ field?: string; issue: string }> = [];
    let errors: Array<{ field?: string; message: string }> = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
        error = exception.name.replace('Exception', '');
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        message = obj.message || exception.message;
        error = obj.error || exception.name.replace('Exception', '');

        if (Array.isArray(obj.details)) {
          details = obj.details;
        }
        if (Array.isArray(obj.errors)) {
          errors = obj.errors;
        } else if (details.length > 0) {
          errors = details.map((d) => ({ field: d.field, message: d.issue }));
        }

        if (Array.isArray(obj.message)) {
          details = obj.message.map((m: string) => ({ issue: m }));
          errors = obj.message.map((m: string) => ({ message: m }));
          message = obj.message[0] || 'Validation failed';
        }
      }
    } else if (exception instanceof ZodError) {
      statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
      error = 'Unprocessable Entity';
      message = exception.errors[0]?.message || 'Validation failed';
      details = exception.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));
      errors = exception.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
    } else if ((exception as any)?.code) {
      // PostgreSQL Error Mapping
      const pgCode = (exception as any).code;
      if (pgCode === '23505') {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        message = 'Data sudah terdaftar dalam sistem';
      } else if (pgCode === '23514') {
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        error = 'Unprocessable Entity';
        message = 'Nilai data melanggar batasan bisnis';
      } else if (pgCode === '23503') {
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        error = 'Unprocessable Entity';
        message = 'Relasi data tidak ditemukan atau tidak valid';
      } else {
        this.logger.error(
          `PostgreSQL Error [${pgCode}]: ${(exception as any).message}`,
          (exception as any).stack
        );
      }
    } else {
      this.logger.error(
        `Unhandled Exception: ${(exception as any)?.message}`,
        (exception as any)?.stack
      );
    }

    // Ensure details and errors are populated if either exists
    if (details.length > 0 && errors.length === 0) {
      errors = details.map((d) => ({ field: d.field, message: d.issue }));
    } else if (errors.length > 0 && details.length === 0) {
      details = errors.map((e) => ({ field: e.field, issue: e.message }));
    }

    const payload: Record<string, any> = {
      success: false,
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      if (!error || error === 'Http') {
        payload.error = 'Too Many Requests';
      }

      let retryAfter: number | undefined;
      const headerVal =
        typeof response.getHeader === 'function'
          ? response.getHeader('Retry-After')
          : undefined;

      if (exception instanceof HttpException) {
        const resObj = exception.getResponse();
        if (
          typeof resObj === 'object' &&
          resObj !== null &&
          typeof (resObj as any).retryAfter === 'number'
        ) {
          retryAfter = (resObj as any).retryAfter;
        }
      }

      if (retryAfter === undefined && headerVal) {
        retryAfter = Number(headerVal);
      }

      if (retryAfter !== undefined && !Number.isNaN(retryAfter)) {
        payload.retryAfter = retryAfter;
        if (typeof response.setHeader === 'function') {
          response.setHeader('Retry-After', String(retryAfter));
        }
      }
    }

    if (details.length > 0) {
      payload.details = details;
    }
    if (errors.length > 0) {
      payload.errors = errors;
    }

    response.status(statusCode).json(payload);
  }
}

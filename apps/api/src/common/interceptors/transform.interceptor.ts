import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Bypass envelope for null, empty or CSV text responses
        if (data === null || data === undefined) return data;

        const contentType = res.getHeader('content-type') as string | undefined;
        if (typeof data === 'string' && contentType?.includes('text/csv')) {
          return data;
        }

        // If already formatted with success property
        if (typeof data === 'object' && 'success' in data) {
          return data;
        }

        // If returned object contains separate data and meta properties (e.g. paginated queries)
        if (typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            data: data.data,
            meta: data.meta,
            ...(data.message ? { message: data.message } : {}),
          };
        }

        // Standard envelope
        return {
          success: true,
          data,
        };
      })
    );
  }
}

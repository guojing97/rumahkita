import {
  PipeTransform,
  ArgumentMetadata,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const targetSchema = this.schema;
    if (!targetSchema) return value;

    const result = targetSchema.safeParse(value);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        issue: err.message,
      }));
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      const firstMessage = result.error.errors[0]?.message || 'Validation failed';

      throw new UnprocessableEntityException({
        message: firstMessage,
        details,
        errors,
      });
    }

    return result.data;
  }
}

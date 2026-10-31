import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const headerKey = request.headers['idempotency-key'] || request.headers['Idempotency-Key'];
    return (headerKey as string | undefined) || request.body?.idempotencyKey;
  }
);

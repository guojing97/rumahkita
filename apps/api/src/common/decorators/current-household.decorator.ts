import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentHouseholdPayload {
  id: string;
  role: 'owner' | 'member';
  name: string;
  currency: string;
  timezone: string;
}

export const CurrentHousehold = createParamDecorator(
  (data: keyof CurrentHouseholdPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const household = request.household;
    return data && household ? household[data] : household;
  }
);

export const CurrentHouseholdId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.household?.id;
  }
);

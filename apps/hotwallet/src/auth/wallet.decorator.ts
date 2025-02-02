import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WALLET_ADDRESS_KEY } from './bitcoin-auth.guard';

export const Wallet = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request[WALLET_ADDRESS_KEY];
  },
);

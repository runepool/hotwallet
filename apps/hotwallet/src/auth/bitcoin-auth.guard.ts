import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

export const WALLET_ADDRESS_KEY = 'bitcoin-wallet';

@Injectable()
export class BitcoinAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-signature'];
    const message = request.headers['x-message'];

    if (!signature || !message) {
      return false;
    }

    const wallet = await this.authService.verifySignature(message, signature);
    if (!wallet) return false;

    request[WALLET_ADDRESS_KEY] = wallet;
    return true;
  }
}

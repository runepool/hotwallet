import { Injectable } from '@nestjs/common';
import * as bitcoin from 'bitcoinjs-lib';

export interface VerifySignatureResult {
  isValid: boolean;
  walletAddress: string;
}


@Injectable()
export class AuthService {
  async verifySignature(
    message: string,
    signature: string,
  ): Promise<string | null> {
    try {
      const { address } = bitcoin.ECPair.fromSignature(
        Buffer.from(signature, 'hex'),
        Buffer.from(message),
      );
      return address;
    } catch (error) {
      return null;
    }
  }
}

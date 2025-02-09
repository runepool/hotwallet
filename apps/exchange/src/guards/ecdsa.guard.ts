import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { secp256k1 } from "@noble/curves/secp256k1";
import { createHash } from 'crypto';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { payments } from 'bitcoinjs-lib';
import { toXOnly } from 'bitcoinjs-lib/src/psbt/bip371';

@Injectable()
export class EcdsaGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const nostrSignature = request.headers['x-nostr-signature'] as string;
    const coreSignature = request.headers['x-core-signature'] as string;
    const nostrPublicKey = request.headers['x-nostr-public-key'] as string;
    const corePublicKey = request.headers['x-core-public-key'] as string;
    const timestamp = request.headers['x-timestamp'] as string;

    if (!nostrSignature || !coreSignature || !nostrPublicKey || !corePublicKey || !timestamp) {
      throw new UnauthorizedException('Missing authentication headers');
    }

    try {
      // Verify timestamp is within 5 minutes
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (currentTime - requestTime > fiveMinutes) {
        throw new UnauthorizedException('Request timestamp expired');
      }

      // Create message to verify
      const method = request.method;
      const path = request.path;
      const body = JSON.stringify(request.body);
      const message = `${method}${path}${body}${timestamp}`;

      // Hash the message
      const messageHash = createHash('sha256')
        .update(message)
        .digest('hex');

      // Convert hex strings to Uint8Arrays
      const nostrSignatureBytes = hexToUint8Array(nostrSignature);
      const coreSignatureBytes = hexToUint8Array(coreSignature);
      const nostrPublicKeyBytes = hexToUint8Array(nostrPublicKey);
      const corePublicKeyBytes = hexToUint8Array(corePublicKey);
      const messageHashBytes = hexToUint8Array(messageHash);

      // Verify signatures
      const isNostrValid = secp256k1.verify(
        nostrSignatureBytes,
        messageHashBytes,
        nostrPublicKeyBytes
      );

      const isCoreValid = secp256k1.verify(
        coreSignatureBytes,
        messageHashBytes,
        corePublicKeyBytes
      );

      if (!isNostrValid || !isCoreValid) {
        throw new UnauthorizedException('Invalid signatures');
      }

      const { address } = payments.p2tr({ internalPubkey: toXOnly(Buffer.from(corePublicKeyBytes)) });

      // Attach verified public keys to request
      request.user = {
        nostrPublicKey,
        corePublicKey,
        address
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  // Remove '0x' prefix if present
  hex = hex.replace('0x', '');

  // Ensure even length
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

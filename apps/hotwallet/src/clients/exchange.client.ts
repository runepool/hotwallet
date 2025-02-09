import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CreateTradeDto, OrderSide } from '../../../exchange/src/dto/trade.dto';
import { CreateRuneOrderDto, UpdateRuneOrderDto } from '../../../exchange/src/rune-orders/dto/rune-orders.dto';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';
import { secp256k1 } from "@noble/curves/secp256k1";
import { createHash } from 'crypto';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';

@Injectable()
export class ExchangeClient implements OnModuleInit {
  private readonly baseUrl = process.env.EXCHANGE_API_URL || 'http://localhost:3001';
  private walletKey: string;
  private nostryKey: string;

  constructor(
    private readonly settingsService: DatabaseSettingsService,
    private readonly httpService: HttpService,
  ) {

  }
  async onModuleInit() {
    const settings = await this.settingsService.getSettings();
    this.setKeys(settings.nostrPrivateKey, settings.bitcoinPrivateKey);
  }

  setKeys(nostrKey: string, walletKey: string) {
    this.nostryKey = nostrKey;
    this.walletKey = walletKey;
  }

  private async signRequest(method: string, path: string, body?: any): Promise<{ nostrSignature: string; coreSignature: string; timestamp: string }> {
    if (!this.nostryKey || !this.walletKey) {
      throw new Error('Nostr private key not set. Call setPrivateKey first.');
    }

    const timestamp = Date.now().toString();
    const message = `${method}${path}${body ? JSON.stringify(body) : '{}'}${timestamp}`;

    // Hash the message
    const messageHash = createHash('sha256')
      .update(message)
      .digest('hex');

    // Convert to Uint8Array
    const messageHashBytes = new Uint8Array(
      Buffer.from(messageHash, 'hex')
    );

    // Sign the message
    const nostrSignatureBytes = secp256k1.sign(
      messageHashBytes,
      this.nostryKey
    );

    const coreSignatureBytes = secp256k1.sign(
      messageHashBytes,
      this.walletKey
    );

    return {
      nostrSignature: nostrSignatureBytes.toCompactHex(),
      coreSignature: coreSignatureBytes.toCompactHex(),
      timestamp
    };
  }

  private async makeAuthenticatedRequest<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const { nostrSignature, coreSignature, timestamp } = await this.signRequest(method, path, body);
    const nostrPublicKey = Buffer.from(secp256k1.getPublicKey(this.nostryKey, true)).toString('hex');
    const corePublicKey = Buffer.from(secp256k1.getPublicKey(this.walletKey, true)).toString('hex');

    const headers = {
      'x-nostr-signature': nostrSignature,
      'x-core-signature': coreSignature,
      'x-nostr-public-key': nostrPublicKey,
      'x-core-public-key': corePublicKey,
      'x-timestamp': timestamp
    };

    const response = await firstValueFrom(
      this.httpService.request({
        method,
        url: `${this.baseUrl}${path}`,
        data: body,
        headers
      })
    );

    return response.data;
  }

  /**
   * Creates a new trade on the exchange
   * @param trade The trade details
   * @returns The created trade response
   * @example
   * const trade = await exchangeClient.createTrade({
   *   side: OrderSide.BUY,
   *   rune: 'btc_usdt',
   *   quantity: 1000000,
   *   takerPaymentAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
   *   takerPaymentPublicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
   *   takerRuneAddress: 'rune1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
   *   takerRunePublicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
   * });
   */
  async createTrade(trade: CreateTradeDto): Promise<any> {
    return this.makeAuthenticatedRequest('POST', '/exchange', trade);
  }

  /**
   * Creates a new rune order
   * @param order The order details
   * @returns The created order
   * @example
   * const order = await exchangeClient.createRuneOrder({
   *   rune: 'btc_usdt',
   *   quantity: BigInt(1000000),
   *   price: BigInt(50000)
   * });
   */
  async createRuneOrder(order: CreateRuneOrderDto): Promise<RuneOrder> {
    return this.makeAuthenticatedRequest('POST', '/rune-orders', order);
  }

  /**
   * Retrieves all rune orders
   * @returns Array of rune orders
   */
  async getAllRuneOrders(): Promise<RuneOrder[]> {
    return this.makeAuthenticatedRequest('GET', '/rune-orders');
  }

  /**
   * Retrieves a specific rune order by ID
   * @param id The order ID
   * @returns The rune order if found
   */
  async getRuneOrder(id: string): Promise<RuneOrder> {
    return this.makeAuthenticatedRequest('GET', `/rune-orders/${id}`);
  }

  /**
   * Updates a rune order
   * @param id The order ID
   * @param updateData The data to update
   * @returns The updated order
   * @example
   * const updatedOrder = await exchangeClient.updateRuneOrder('order-id', {
   *   quantity: BigInt(2000000),
   *   price: BigInt(51000),
   *   status: OrderStatus.CLOSED
   * });
   */
  async updateRuneOrder(id: string, updateData: UpdateRuneOrderDto): Promise<RuneOrder> {
    return this.makeAuthenticatedRequest('PATCH', `/rune-orders/${id}`, updateData);
  }

  /**
   * Cancels/removes a rune order
   * @param id The order ID to cancel
   */
  async cancelRuneOrder(id: string): Promise<void> {
    return this.makeAuthenticatedRequest('DELETE', `/rune-orders/${id}`);
  }

  async deleteRuneOrder(orderId: string): Promise<void> {
    await this.makeAuthenticatedRequest<void>('DELETE', `/rune-orders/${orderId}`);
  }
}

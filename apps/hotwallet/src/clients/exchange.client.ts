import { RuneOrder } from '@app/database/entities/rune-order.entity';
import { DatabaseSettingsService } from '@app/database/settings/settings.service';
import { BitcoinWalletService } from '@app/wallet';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { secp256k1 } from "@noble/curves/secp256k1";
import { createHash } from 'crypto';
import { lastValueFrom } from 'rxjs';
import { BatchCreateRuneOrderDto, BatchDeleteRuneOrderDto, CreateRuneOrderDto, UpdateRuneOrderDto } from './dto/rune-orders.dto';
import { CreateTradeDto } from './dto/trade.dto';

@Injectable()
export class ExchangeClient {
  private readonly baseUrl = process.env.NODE_ENV === 'production' ? 'https://exchange-api.runepool.org' : 'http://localhost:3001';

  constructor(
    private readonly walletService: BitcoinWalletService,
    private readonly httpService: HttpService,
  ) {

  }

  private async signRequest(method: string, path: string, body?: any): Promise<{ coreSignature: string; timestamp: string; corePublicKey: string }> {
    return this.walletService.withSigner((signer) => {
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
      const coreSignatureBytes = secp256k1.sign(
        messageHashBytes,
        signer.privateKey
      );

      const corePublicKey = Buffer.from(secp256k1.getPublicKey(signer.privateKey, true)).toString('hex');

      return {
        coreSignature: coreSignatureBytes.toCompactHex(),
        timestamp,
        corePublicKey
      };
    });
  }

  private async makeAuthenticatedRequest<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const { coreSignature, timestamp, corePublicKey } = await this.signRequest(method, path, body);

    const headers = {
      'x-core-signature': coreSignature,
      'x-core-public-key': corePublicKey,
      'x-timestamp': timestamp
    };

    const response = await lastValueFrom(
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
   * Sends a ping to the exchange server to indicate the client is active
   * This helps the exchange server track which market makers are online
   * @returns A promise that resolves when the ping is complete
   */
  async ping(): Promise<void> {
    try {
      await this.makeAuthenticatedRequest<void>('GET', '/rune-orders/ping');
    } catch (error) {
      // Silently handle ping errors to avoid disrupting normal operation
      console.error('Failed to ping exchange server:', error.message);
      throw error;
    }
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
   * Creates multiple rune orders in a single batch operation
   * @param orders Array of orders to create
   * @returns Result of the batch create operation with created orders and any errors
   * @example
   * const result = await exchangeClient.batchCreateRuneOrders({
   *   orders: [
   *     {
   *       uuid: 'order-uuid-1',
   *       rune: 'btc_usdt',
   *       quantity: BigInt(1000000),
   *       price: BigInt(50000),
   *       type: RuneOrderType.BUY
   *     },
   *     {
   *       uuid: 'order-uuid-2',
   *       rune: 'btc_usdt',
   *       quantity: BigInt(2000000),
   *       price: BigInt(51000),
   *       type: RuneOrderType.SELL
   *     }
   *   ]
   * });
   * console.log(`Successfully created ${result.createdOrders.length} orders`);
   */
  async batchCreateRuneOrders(orders: CreateRuneOrderDto[]): Promise<{ success: boolean; createdOrders: RuneOrder[]; errors?: string[] }> {
    const batchCreateDto: BatchCreateRuneOrderDto = { orders };
    return this.makeAuthenticatedRequest('POST', '/rune-orders/batch/create', batchCreateDto);
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
   * });
   */
  async updateRuneOrder(id: string, updateData: UpdateRuneOrderDto): Promise<RuneOrder> {
    return this.makeAuthenticatedRequest('PUT', `/rune-orders/${id}`, updateData);
  }

  /**
   * Deletes a rune order
   * @param id The order ID
   * @returns A success indicator
   */
  async deleteRuneOrder(id: string): Promise<{ success: boolean }> {
    return this.makeAuthenticatedRequest('DELETE', `/rune-orders/${id}`);
  }

  /**
   * Deletes multiple rune orders in a single batch operation
   * @param ids Array of order IDs to delete
   * @returns Result of the batch delete operation
   * @example
   * const result = await exchangeClient.batchDeleteRuneOrders(['order-id-1', 'order-id-2']);
   * console.log(`Successfully deleted ${result.deletedCount} orders`);
   */
  async batchDeleteRuneOrders(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    const batchDeleteDto: BatchDeleteRuneOrderDto = { orderIds: ids };
    return this.makeAuthenticatedRequest('POST', '/rune-orders/batch/delete', batchDeleteDto);
  }

  /**
  * Retrieves all rune orders belonging to the authenticated user
  * @returns Array of rune orders owned by the authenticated user
  */
  async getMyOrders(): Promise<RuneOrder[]> {
    return this.makeAuthenticatedRequest('GET', '/rune-orders/my-orders');
  }
}

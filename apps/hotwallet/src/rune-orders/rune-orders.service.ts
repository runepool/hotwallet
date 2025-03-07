import { RunesService } from '@app/blockchain/runes/runes.service';
import { OrderStatus, RuneOrder } from '@app/database/entities/rune-order.entity';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateBatchRuneOrderDto, CreateRuneOrderDto } from '../dto/rune-orders.dto';
import { RuneOrdersService as DbService } from '@app/database/rune-orders/rune-orders-database.service';
import { ExchangeClient } from '../clients/exchange.client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RuneOrdersService  {
  private readonly logger = new Logger(RuneOrdersService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly runeService: RunesService,
    private readonly exchangeClient: ExchangeClient,
  ) { }

  
  async createOrder(orderData: CreateRuneOrderDto): Promise<RuneOrder> {
    const runeInfo = await this.runeService.getRuneInfo(orderData.rune);

    const order = {
      rune: orderData.rune,
      price: BigInt(orderData.price),
      quantity: BigInt(+orderData.quantity * 10 ** runeInfo.decimals),
      status: OrderStatus.OPEN,
      type: orderData.type
    } as Partial<RuneOrder>;

    // Create order locally
    const localOrder = await this.dbService.createOrder(order);

    try {
      // Mirror order to exchange
      await this.exchangeClient.createRuneOrder({
        uuid: localOrder.id,
        rune: localOrder.rune,
        quantity: localOrder.quantity,
        price: localOrder.price,
        type: localOrder.type as any
      });
      this.logger.log(`Order ${localOrder.id} mirrored to exchange successfully`);
    } catch (error) {
      this.logger.error(`Failed to mirror order ${localOrder.id} to exchange: ${error.message}`);
      // We might want to mark the local order as failed or handle this error differently
      // depending on your business requirements
    }

    return localOrder;
  }

  async createBatchOrders(batchData: CreateBatchRuneOrderDto): Promise<RuneOrder[]> {
    const orders = await Promise.all(batchData.orders.map(async order => {
      const runeInfo = await this.runeService.getRuneInfo(order.rune);

      return ({
        rune: order.rune,
        price: BigInt(order.price),
        quantity: BigInt(+order.quantity * 10 ** runeInfo.decimals),
        type: order.type
      });
    }));

    // Create orders locally
    const localOrders = await this.dbService.save(orders);

    // Mirror orders to exchange
    await Promise.all(localOrders.map(async (localOrder) => {
      try {
        await this.exchangeClient.createRuneOrder({
          uuid: localOrder.id,
          rune: localOrder.rune,
          quantity: localOrder.quantity,
          price: localOrder.price,
          type: localOrder.type as any
        });
        this.logger.log(`Order ${localOrder.id} mirrored to exchange successfully`);
      } catch (error) {
        this.logger.error(`Failed to mirror order ${localOrder.id} to exchange: ${error.message}`);
        // Handle error based on business requirements
      }
    }));

    return localOrders;
  }

  async getOrders(asset?: string, status?: string): Promise<RuneOrder[]> {
    return await this.dbService.getOrders(asset, status);
  }

  async getOrderById(orderId: string): Promise<RuneOrder | null> {
    return await this.dbService.getOrderById(orderId);
  }

  async updateOrder(orderId: string, updateData: Partial<RuneOrder>): Promise<RuneOrder | null> {
    return await this.dbService.updateOrder(orderId, updateData);
  }

  async deleteOrder(orderId: string): Promise<void> {
    // Delete local order
    await this.dbService.deleteOrder(orderId);

    // Mirror delete to exchange
    try {
      await this.exchangeClient.deleteRuneOrder(orderId);
      this.logger.log(`Successfully mirrored delete for order ${orderId} to exchange`);
    } catch (error) {
      this.logger.error(`Failed to mirror delete for order ${orderId} to exchange: ${error.message}`);
      throw error;
    }
  }
}

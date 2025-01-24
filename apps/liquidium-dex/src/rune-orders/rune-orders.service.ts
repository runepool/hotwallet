import { Injectable } from '@nestjs/common';
import { CreateRuneOrderDto, CreateBatchRuneOrderDto } from '../dto/rune-orders.dto';
import { RuneOrder } from '@app/database/entities/rune-order';
import { RuneOrdersService as PersistenceService } from '@app/database/rune-orders/rune-orders.service';
import { NostrService } from '@app/nostr';

@Injectable()
export class RuneOrdersService {
  constructor(
    private readonly nostrService: NostrService,
    private readonly dbService: PersistenceService) { }

  async createOrder(orderData: CreateRuneOrderDto): Promise<RuneOrder> {
    const order = {
      rune: orderData.rune,
      price: BigInt(orderData.price),
      quantity: BigInt(orderData.quantity),
      type: orderData.type
    } as RuneOrder;

    await this.nostrService.publishOrder(order);
    const orders = await this.dbService.createOrder(order);
    return orders;

  }

  async createBatchOrders(batchData: CreateBatchRuneOrderDto): Promise<RuneOrder[]> {
    const orders = batchData.orders.map(order => ({
      rune: order.rune,
      price: BigInt(order.price),
      quantity: BigInt(order.quantity),
      type: order.type
    }));

    for (const order of orders) {
      await this.nostrService.publishOrder(order as any);
    }
    
    return await this.dbService.createBatchOrders(orders);
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
    await this.dbService.deleteOrder(orderId);
  }
}

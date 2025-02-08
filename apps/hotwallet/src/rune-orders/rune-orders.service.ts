import { RunesService } from '@app/blockchain/runes/runes.service';

import { RuneOrder } from '@app/database/entities/rune-order.entity';
import { Injectable } from '@nestjs/common';
import { CreateBatchRuneOrderDto, CreateRuneOrderDto } from '../dto/rune-orders.dto';
import { RuneOrdersService as DbService } from '@app/database/rune-orders/rune-orders-database.service';

@Injectable()
export class RuneOrdersService {
  constructor(
    private readonly dbService: DbService,
    private readonly runeService: RunesService) { }

  async createOrder(orderData: CreateRuneOrderDto): Promise<RuneOrder> {

    const runeInfo = await this.runeService.getRuneInfo(orderData.rune);

    const order = {
      rune: orderData.rune,
      price: BigInt(orderData.price),
      quantity: BigInt(+orderData.quantity * 10 ** runeInfo.decimals),
      type: orderData.type
    } as Partial<RuneOrder>;

    const orders = await this.dbService.createOrder(order);
    return orders;

  }

  async createBatchOrders(batchData: CreateBatchRuneOrderDto): Promise<RuneOrder[]> {
    const orders = batchData.orders.map(async order => {
      const runeInfo = await this.runeService.getRuneInfo(order.rune);

      return ({
        rune: order.rune,
        price: BigInt(order.price),
        quantity: BigInt(+order.quantity * 10 ** runeInfo.decimals),
        type: order.type
      })
    });

    return await this.dbService.save(await Promise.all(orders));
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

import { RunesService } from '@app/blockchain/runes/runes.service';
import { RuneOrder } from '@app/database/entities/rune-order';
import { RuneOrdersService as PersistenceService } from '@app/database/rune-orders/rune-orders.service';
import { Injectable } from '@nestjs/common';
import { CreateBatchRuneOrderDto, CreateRuneOrderDto } from '../dto/rune-orders.dto';

@Injectable()
export class RuneOrdersService {
  constructor(
    private readonly runeService: RunesService,
    private readonly dbService: PersistenceService) { }

  async createOrder(orderData: CreateRuneOrderDto): Promise<RuneOrder> {

    const runeInfo = await this.runeService.getRuneInfo(orderData.rune);

    const order = {
      rune: orderData.rune,
      price: BigInt(orderData.price),
      quantity: BigInt(+orderData.quantity * 10 ** runeInfo.decimals),
      type: orderData.type
    } as RuneOrder;

    // await this.nostrService.publishOrder(order);
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

    for (const order of orders) {
      // await this.nostrService.publishOrder(order as any);
    }

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

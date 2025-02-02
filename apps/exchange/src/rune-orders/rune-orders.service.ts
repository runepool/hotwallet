import { Injectable } from '@nestjs/common';
import { RuneOrdersService as RuneOrdersDatabaseService } from '@app/exchange-database/rune-orders/rune-orders-database.service';
import { CreateRuneOrderDto, UpdateRuneOrderDto } from './dto/rune-orders.dto';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';

@Injectable()
export class RuneOrdersService {
  constructor(
    private readonly runeOrdersDatabaseService: RuneOrdersDatabaseService,
  ) { }

  async create(createOrderDto: CreateRuneOrderDto): Promise<RuneOrder> {
    return this.runeOrdersDatabaseService.createOrder(createOrderDto);
  }

  async findAll(): Promise<RuneOrder[]> {
    return this.runeOrdersDatabaseService.getOrders();
  }

  async findOne(id: string): Promise<RuneOrder> {
    return this.runeOrdersDatabaseService.getOrderById(id);
  }

  async update(id: string, updateOrderDto: UpdateRuneOrderDto): Promise<RuneOrder> {
    const order = await this.runeOrdersDatabaseService.getOrderById(id);
    if (!order) {
      throw new Error('Order not found');
    }
    return this.runeOrdersDatabaseService.updateOrder(id, updateOrderDto);
  }

  async remove(id: string): Promise<void> {
    await this.runeOrdersDatabaseService.deleteOrder(id);
  }
}

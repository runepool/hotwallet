import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { RuneOrder, RuneOrderType } from '../entities/rune-order';

@Injectable()
export class RuneOrdersService {
    constructor(
        @InjectRepository(RuneOrder)
        private readonly runeOrderRepository: Repository<RuneOrder>,
    ) { }

    async createOrder(orderData: DeepPartial<RuneOrder>): Promise<RuneOrder> {
        return await this.runeOrderRepository.save(orderData);
    }

    async save(batchData: DeepPartial<RuneOrder>[]): Promise<RuneOrder[]> {
        return await this.runeOrderRepository.save(batchData);
    }

    async getOrders(asset?: string, status?: string, type?: RuneOrderType): Promise<RuneOrder[]> {
        const query = this.runeOrderRepository.createQueryBuilder('order');

        if (asset) {
            query.andWhere('order.rune = :asset', { asset });
        }

        if (status) {
            query.andWhere('order.status = :status', { status });
        }

        if (type) {
            query.andWhere('order.type = :type', { type });
        }

        query.orderBy({
            'price': type === 'bid' ? 'ASC' : 'DESC'
        })

        return await query.getMany();
    }

    async getOrderById(orderId: string): Promise<RuneOrder | null> {
        return await this.runeOrderRepository.findOneBy({ id: orderId });
    }

    async updateOrder(orderId: string, updateData: Partial<RuneOrder>): Promise<RuneOrder | null> {
        await this.runeOrderRepository.update(orderId, updateData);
        return await this.getOrderById(orderId);
    }

    async deleteOrder(orderId: string): Promise<void> {
        await this.runeOrderRepository.delete(orderId);
    }
}

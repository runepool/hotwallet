import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { RuneOrder, RuneOrderType } from '../entities/rune-order.entity';


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

    /**
     * Gets all unique makers with their information from the orders table
     * @returns Array of unique makers with their nostr key, public key, and address
     */
    async getAllMakers(): Promise<{ makerNostrKey: string; makerPublicKey: string; makerAddress: string }[]> {
        // Get distinct makers with their information
        const makers = await this.runeOrderRepository
            .createQueryBuilder('order')
            .select([
                'order.makerNostrKey',
                'order.makerPublicKey',
                'order.makerAddress'
            ])
            .distinctOn(['order.makerPublicKey'])
            .getRawMany();

        return makers.map(maker => ({
            makerNostrKey: maker.order_makerNostrKey,
            makerPublicKey: maker.order_makerPublicKey,
            makerAddress: maker.order_makerAddress
        }));
    }

    /**
     * Gets all active makers with at least one open order
     * @returns Array of active makers with their information
     */
    async getActiveMakers(): Promise<{ makerNostrKey: string; makerPublicKey: string; makerAddress: string }[]> {
        // Get distinct makers with at least one open order
        const makers = await this.runeOrderRepository
            .createQueryBuilder('order')
            .select([
                'order.makerNostrKey',
                'order.makerPublicKey',
                'order.makerAddress'
            ])
            .where('order.status = :status', { status: 'open' })
            .distinctOn(['order.makerPublicKey'])
            .getRawMany();

        return makers.map(maker => ({
            makerNostrKey: maker.order_makerNostrKey,
            makerPublicKey: maker.order_makerPublicKey,
            makerAddress: maker.order_makerAddress
        }));
    }

    async getOrders(asset?: string, status?: string, type?: RuneOrderType, owner?: string): Promise<RuneOrder[]> {
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

        if (owner) {
            query.andWhere('order.makerPublicKey = :owner', { owner });
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

    /**
     * Deletes multiple rune orders by their IDs
     * @param orderIds Array of order IDs to delete
     * @returns Promise resolving to the number of orders deleted
     */
    async batchDeleteOrders(orderIds: string[]): Promise<number> {
        if (!orderIds || orderIds.length === 0) {
            return 0;
        }

        const result = await this.runeOrderRepository.delete(orderIds);
        return result.affected || 0;
    }

    /**
     * Deletes all orders for a specific maker
     * @param makerPublicKey The public key of the maker whose orders should be deleted
     * @returns Promise resolving to the number of orders deleted
     */
    async deleteOrdersByMaker(makerPublicKey: string): Promise<number> {
        if (!makerPublicKey) {
            return 0;
        }

        const result = await this.runeOrderRepository.delete({ makerPublicKey });
        return result.affected || 0;
    }
}

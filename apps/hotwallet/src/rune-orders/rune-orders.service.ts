import { RunesService } from '@app/blockchain/runes/runes.service';
import { OrderStatus, RuneOrder } from '@app/database/entities/rune-order.entity';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateBatchRuneOrderDto, CreateRuneOrderDto } from '../dto/rune-orders.dto';
import { RuneOrdersService as DbService } from '@app/database/rune-orders/rune-orders-database.service';
import { ExchangeClient } from '../clients/exchange.client';
import { Cron, CronExpression } from '@nestjs/schedule';

interface DeleteBatchRuneOrderDto {
  orders: RuneOrder[];
}

@Injectable()
export class RuneOrdersService {
  private readonly logger = new Logger(RuneOrdersService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly runeService: RunesService,
    private readonly exchangeClient: ExchangeClient,
  ) {
    setTimeout(() => {
      this.syncOrders();
      this.pingExchange();
    }, 2000);
  }


  async createOrder(orderData: CreateRuneOrderDto): Promise<RuneOrder> {

    const order = {
      rune: orderData.rune,
      price: BigInt(orderData.price),
      quantity: BigInt(orderData.quantity),
      status: OrderStatus.OPEN,
      type: orderData.type
    } as Partial<RuneOrder>;

    // Create order locally
    const localOrder = await this.dbService.createOrder(order);

    try {
      // Mirror order to exchange
      await this.exchangeClient.createRuneOrder({
        id: localOrder.id,
        rune: localOrder.rune,
        quantity: localOrder.quantity,
        price: localOrder.price,
        type: localOrder.type as any
      });
      this.logger.log(`Order ${localOrder.id} mirrored to exchange successfully`);
    } catch (error) {
      console.log(error)
      this.logger.error(`Failed to mirror order ${localOrder.id} to exchange: ${error.message}`);

    }

    return localOrder;
  }

  async createBatchOrders(batchData: CreateBatchRuneOrderDto): Promise<RuneOrder[]> {
    const orders = await Promise.all(batchData.orders.map(async order => {

      return ({
        rune: order.rune,
        price: BigInt(order.price),
        quantity: BigInt(order.quantity),
        type: order.type
      });
    }));

    // Create orders locally
    const localOrders = await this.dbService.save(orders);
    this.logger.log(`Successfully created ${localOrders.length} orders in local database`);

    // Prepare orders for exchange batch creation
    const exchangeOrders = localOrders.map(localOrder => ({
      id: localOrder.id,
      rune: localOrder.rune,
      quantity: localOrder.quantity,
      price: localOrder.price,
      type: localOrder.type as any
    }));

    // Mirror orders to exchange using batch create
    try {
      const result = await this.exchangeClient.batchCreateRuneOrders(exchangeOrders);
      this.logger.log(`Successfully mirrored ${result.createdOrders.length} orders to exchange`);

      if (result.errors && result.errors.length > 0) {
        this.logger.warn(`Some orders failed to create on exchange: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Failed to mirror orders to exchange: ${error.message}`);
    }

    return localOrders;
  }

  async getOrders(asset?: string, status?: string): Promise<RuneOrder[]> {
    return await this.dbService.getOrders(asset, status);
  }

  /**
   * Gets only active (open) orders
   * @param asset Optional asset (rune) to filter by
   * @returns Promise resolving to an array of active orders
   */
  async getActiveOrders(asset?: string): Promise<RuneOrder[]> {
    return await this.dbService.getOrders(asset, 'open');
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

  /**
   * Deletes multiple orders in a batch operation
   * @param batchData Object containing array of orders to delete
   * @returns Promise that resolves when the operation is complete
   */
  async deleteBatchOrders(batchData: { orders: RuneOrder[] }): Promise<void> {
    if (!batchData.orders || batchData.orders.length === 0) {
      return;
    }

    const orderIds = batchData.orders.map(order => order.id);
    this.logger.log(`Deleting ${orderIds.length} orders in batch`);

    try {
      // Delete orders locally first
      const deletedCount = await this.dbService.deleteBatchOrders(orderIds);
      this.logger.log(`Successfully deleted ${deletedCount} orders from local database`);

      // Then use the batch delete endpoint to delete from exchange
      const result = await this.exchangeClient.batchDeleteRuneOrders(orderIds);

      this.logger.log(`Exchange batch delete result: ${result.deletedCount} orders deleted successfully`);

      if (result.errors && result.errors.length > 0) {
        this.logger.warn(`Some orders failed to delete on exchange: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`Error in batch delete operation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Periodically pings the exchange server to indicate that this hotwallet is active
   * This helps the exchange track which market makers are online and responsive
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async pingExchange() {
    try {
      await this.exchangeClient.ping();
      this.logger.debug('Successfully pinged exchange server');
    } catch (error) {
      this.logger.warn(`Failed to ping exchange server: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async syncOrders() {
    try {

      this.logger.log('Starting order synchronization');
      const localOrders = await this.dbService.getOrders();
      const exchangeOrders = await this.exchangeClient.getMyOrders();

      this.logger.log(`Found ${localOrders.length} local orders and ${exchangeOrders.length} exchange orders`);

      // Compare orders and update/create/delete as needed  
      const ordersToCreate = [];
      const indexes = [];
      for (const order of localOrders) {
        const exchangeOrderIndex = exchangeOrders.findIndex(o => o.id === order.id);
        if (exchangeOrderIndex === -1) {
          // Order exists in exchange, update status
          ordersToCreate.push(order)
        } else {
          indexes.push(exchangeOrderIndex);
        }
      }

      // Delete orders that are not in exchange
      const ordersToDelete = exchangeOrders.filter((_, index) => !indexes.includes(index));

      if (ordersToCreate.length > 0) {
        await this.exchangeClient.batchCreateRuneOrders(ordersToCreate);
      }

      if (ordersToDelete.length > 0) {
        await this.exchangeClient.batchDeleteRuneOrders(ordersToDelete.map(o => o.id));
      }

      this.logger.log('Order synchronization completed');
    } catch (error) {
      this.logger.error(`Failed to sync orders: ${error.message}`);
    }
  }
}

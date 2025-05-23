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
    // Check if there's an existing order at the same price
    const existingOrders = await this.dbService.getOrders(orderData.rune, OrderStatus.OPEN);
    const existingOrder = existingOrders.find(o => 
      o.type === orderData.type && 
      o.price === BigInt(orderData.price)
    );

    if (existingOrder) {
      // Merge with existing order
      this.logger.log(`Found existing order ${existingOrder.id} at price ${orderData.price} for ${orderData.rune}. Merging quantities.`);
      
      // Update the existing order with the new quantity
      const updatedQuantity = existingOrder.quantity + BigInt(orderData.quantity);
      const updatedOrder = await this.dbService.updateOrder(existingOrder.id, {
        quantity: updatedQuantity
      });

      try {
        // Update the order on the exchange
        await this.exchangeClient.createRuneOrder({
          id: existingOrder.id,
          rune: existingOrder.rune,
          quantity: updatedQuantity,
          price: existingOrder.price,
          type: existingOrder.type as any
        });
        this.logger.log(`Order ${existingOrder.id} updated on exchange successfully with new quantity ${updatedQuantity}`);
      } catch (error) {
        this.logger.error(`Failed to update order ${existingOrder.id} on exchange: ${error.message}`);
      }

      return updatedOrder;
    }
    
    // No existing order at this price, create a new one
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
   * @param orderIds Array of order IDs to delete
   * @returns Promise that resolves when the operation is complete
   */
  async deleteBatchOrders(orderIds: string[]): Promise<void> {
    if (!orderIds || orderIds.length === 0) {
      return;
    }

    this.logger.log(`Deleting ${orderIds.length} orders in batch`);

    try {
      // Delete orders locally first
      const deletedCount = await this.dbService.deleteBatchOrders(orderIds);
      this.logger.log(`Successfully deleted ${deletedCount} orders from local database`);

      // Then use the batch delete endpoint to delete from exchange
      const result = await this.exchangeClient.batchDeleteRuneOrders(orderIds);

      this.logger.log(`Exchange batch delete result: ${result.deletedCount} orders deleted successfully`);

      if (!result.success) {
        this.logger.warn(`Some orders failed to delete on exchange`);
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


      // Delete orders that are not in exchange
      const ordersToDelete = exchangeOrders.filter((_, index) => {
        const localOrderIndex = localOrders.findIndex(o => o.id === exchangeOrders[index].id);
        return localOrderIndex === -1;
      });

      if (localOrders.length > 0) {
        await this.exchangeClient.batchCreateRuneOrders(localOrders as any);
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

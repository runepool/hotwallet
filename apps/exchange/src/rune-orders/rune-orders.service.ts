import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RuneOrdersService as RuneOrdersDatabaseService } from '@app/exchange-database/rune-orders/rune-orders-database.service';
import { BatchCreateRuneOrderDto, BatchDeleteRuneOrderDto, CreateRuneOrderDto, UpdateRuneOrderDto } from './dto/rune-orders.dto';
import { RuneOrder, RuneOrderType } from '@app/exchange-database/entities/rune-order.entity';

@Injectable()
export class RuneOrdersService {
  private readonly logger = new Logger(RuneOrdersService.name);

  constructor(
    private readonly runeOrdersDatabaseService: RuneOrdersDatabaseService,
  ) { }

  async create(createOrderDto: CreateRuneOrderDto): Promise<RuneOrder> {
    return this.runeOrdersDatabaseService.createOrder(createOrderDto);
  }

  /**
   * Creates multiple orders in a batch operation
   * @param batchCreateDto DTO containing array of orders to create
   * @param makerNostrKey Maker's nostr public key
   * @param makerPublicKey Maker's core public key
   * @param makerAddress Maker's address
   * @returns Result of the batch create operation with created orders and any errors
   */
  async batchCreate(
    batchCreateDto: BatchCreateRuneOrderDto,
    makerNostrKey: string,
    makerPublicKey: string,
    makerAddress: string
  ): Promise<{ success: boolean; createdOrders: RuneOrder[]; errors?: string[] }> {
    this.logger.log(`Attempting to create ${batchCreateDto.orders.length} orders in batch for maker ${makerPublicKey}`);
    
    const errors = [];
    const createdOrders = [];
    
    // Process each order creation
    for (const orderDto of batchCreateDto.orders) {
      try {
        // Add maker information to each order
        const orderWithMaker = {
          ...orderDto,
          id: orderDto.id,
          makerNostrKey,
          makerPublicKey,
          makerAddress
        };
        
        // Create the order
        const createdOrder = await this.runeOrdersDatabaseService.createOrder(orderWithMaker);
        createdOrders.push(createdOrder);
        this.logger.log(`Successfully created order ${createdOrder.id} for maker ${makerPublicKey}`);
      } catch (error) {
        this.logger.error(`Failed to create order with UUID ${orderDto.id}: ${error.message}`);
        errors.push(`Failed to create order with UUID ${orderDto.id}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      createdOrders,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async findAll(): Promise<RuneOrder[]> {
    return this.runeOrdersDatabaseService.getOrders();
  }

  async findByOwner(owner: string, asset?: string, status?: string, type?: RuneOrderType): Promise<RuneOrder[]> {
    return this.runeOrdersDatabaseService.getOrders(asset, status, type, owner);
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

  /**
   * Deletes multiple orders in a batch operation
   * @param batchDeleteDto DTO containing array of order IDs to delete
   * @param ownerPublicKey Public key of the authenticated user
   * @returns Result of the batch delete operation with count of deleted orders and any errors
   */
  async batchRemove(batchDeleteDto: BatchDeleteRuneOrderDto, ownerPublicKey: string): Promise<{ success: boolean; deletedCount: number; errors?: string[] }> {
    this.logger.log(`Attempting to delete ${batchDeleteDto.orderIds.length} orders in batch for owner ${ownerPublicKey}`);
    
    if (!batchDeleteDto.orderIds || batchDeleteDto.orderIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const errors = [];
    let deletedCount = 0;
    const validOrderIds = [];
    
    // First verify ownership of all orders in a single batch operation
    try {
      // Get all orders in one database call
      const ordersToCheck = await Promise.all(
        batchDeleteDto.orderIds.map(id => this.runeOrdersDatabaseService.getOrderById(id))
      );
      
      // Verify each order exists and belongs to the owner
      for (let i = 0; i < ordersToCheck.length; i++) {
        const order = ordersToCheck[i];
        const orderId = batchDeleteDto.orderIds[i];
        
        if (!order) {
          errors.push(`Order ${orderId} not found`);
          continue;
        }
        
        if (order.makerPublicKey !== ownerPublicKey) {
          errors.push(`Order ${orderId} does not belong to the authenticated user`);
          continue;
        }
        
        // If ownership is verified, add to valid IDs for batch deletion
        validOrderIds.push(orderId);
      }
      
      // If we have valid orders to delete, use batch delete
      if (validOrderIds.length > 0) {
        deletedCount = await this.runeOrdersDatabaseService.batchDeleteOrders(validOrderIds);
        this.logger.log(`Successfully deleted ${deletedCount} orders owned by ${ownerPublicKey}`);
      }
    } catch (error) {
      this.logger.error(`Error in batch delete operation: ${error.message}`);
      errors.push(`Batch delete operation failed: ${error.message}`);
    }
    
    return {
      success: errors.length === 0,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

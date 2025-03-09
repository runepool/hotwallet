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
        this.logger.error(`Failed to create order with UUID ${orderDto.uuid}: ${error.message}`);
        errors.push(`Failed to create order with UUID ${orderDto.uuid}: ${error.message}`);
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

  async batchRemove(batchDeleteDto: BatchDeleteRuneOrderDto, ownerPublicKey: string): Promise<{ success: boolean; deletedCount: number; errors?: string[] }> {
    this.logger.log(`Attempting to delete ${batchDeleteDto.orderIds.length} orders in batch for owner ${ownerPublicKey}`);
    
    const errors = [];
    let deletedCount = 0;
    
    // Process each order deletion with ownership check
    for (const orderId of batchDeleteDto.orderIds) {
      try {
        // First, verify the order exists and belongs to the owner
        const order = await this.runeOrdersDatabaseService.getOrderById(orderId);
        
        if (!order) {
          throw new NotFoundException(`Order ${orderId} not found`);
        }
        
        // Check if the order belongs to the authenticated user
        if (order.makerPublicKey !== ownerPublicKey) {
          throw new ForbiddenException(`Order ${orderId} does not belong to the authenticated user`);
        }
        
        // If ownership is verified, proceed with deletion
        await this.runeOrdersDatabaseService.deleteOrder(orderId);
        deletedCount++;
        this.logger.log(`Successfully deleted order ${orderId} owned by ${ownerPublicKey}`);
      } catch (error) {
        this.logger.error(`Failed to delete order ${orderId}: ${error.message}`);
        errors.push(`Failed to delete order ${orderId}: ${error.message}`);
      }
    }
    
    return {
      success: errors.length === 0,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

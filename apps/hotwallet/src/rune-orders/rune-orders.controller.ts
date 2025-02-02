import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateRuneOrderDto, CreateBatchRuneOrderDto } from '../dto/rune-orders.dto';
import { RuneOrdersService } from './rune-orders.service';

@ApiTags('Orders')
@Controller('orders')
export class RuneOrdersController {
  constructor(private readonly ordersService: RuneOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async createOrder(@Body() createOrderDto: CreateRuneOrderDto) {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Create multiple orders' })
  @ApiResponse({ status: 201, description: 'Orders successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async createBatchOrders(@Body() createBatchOrderDto: CreateBatchRuneOrderDto) {
    return this.ordersService.createBatchOrders(createBatchOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully.' })
  async getOrders() {
    return this.ordersService.getOrders();
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async getOrderById(@Param('orderId') orderId: string) {
    return this.ordersService.getOrderById(orderId);
  }

  @Delete(':orderId')
  @ApiOperation({ summary: 'Delete order by ID' })
  @ApiResponse({ status: 200, description: 'Order deleted successfully.' })
  async deleteOrderById(@Param('orderId') orderId: string) {
    return this.ordersService.deleteOrder(orderId);
  }
}
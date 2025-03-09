import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EcdsaGuard } from '../guards/ecdsa.guard';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { BatchCreateRuneOrderDto, BatchDeleteRuneOrderDto, CreateRuneOrderDto, UpdateRuneOrderDto } from './dto/rune-orders.dto';
import { RuneOrdersService } from './rune-orders.service';

@ApiTags('Rune Orders')
@Controller('rune-orders')
@UseGuards(EcdsaGuard)
@ApiHeader({ name: 'x-nostr-signature', description: 'ECDSA signature of the request using nostr key' })
@ApiHeader({ name: 'x-core-signature', description: 'ECDSA signature of the request using core key' })
@ApiHeader({ name: 'x-nostr-public-key', description: 'Nostr public key used to sign the request' })
@ApiHeader({ name: 'x-core-public-key', description: 'Core public key used to sign the request' })
@ApiHeader({ name: 'x-timestamp', description: 'Request timestamp in milliseconds' })
export class RuneOrdersController {
  constructor(private readonly ordersService: RuneOrdersService) { }

  @Post('batch/create')
  @ApiOperation({ summary: 'Create multiple rune orders in batch' })
  @ApiResponse({ status: 201, description: 'The orders have been processed for creation.' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  batchCreate(@Req() req: AuthenticatedRequest, @Body() batchCreateDto: BatchCreateRuneOrderDto) {
    // Access the verified public keys
    const { nostrPublicKey, corePublicKey, address } = req.user;

    // Pass the batch data and maker information to the service
    return this.ordersService.batchCreate(
      batchCreateDto,
      nostrPublicKey,
      corePublicKey,
      address
    );
  }


  @Get()
  @ApiOperation({ summary: 'Get all rune orders' })
  @ApiResponse({ status: 200, description: 'Returns all rune orders' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.ordersService.findAll();
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Get all rune orders for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns all rune orders for the authenticated user' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  getOrders(@Req() req: AuthenticatedRequest) {
    const { corePublicKey } = req.user;
    return this.ordersService.findByOwner(corePublicKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rune order by id' })
  @ApiResponse({ status: 200, description: 'Returns the rune order' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rune order' })
  @ApiResponse({ status: 200, description: 'The order has been successfully updated.' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateRuneOrderDto
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a rune order' })
  @ApiResponse({ status: 200, description: 'The order has been successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  remove(@Req() @Param('id') id: string) {
    return this.ordersService.remove(id);
  }

  @Delete('batch/delete')
  @ApiOperation({ summary: 'Delete multiple rune orders in batch' })
  @ApiResponse({ status: 200, description: 'The orders have been processed for deletion.' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 403, description: 'Attempted to delete orders not owned by the user' })
  batchDelete(@Req() req: AuthenticatedRequest, @Body() batchDeleteDto: BatchDeleteRuneOrderDto) {
    // Extract the owner's public key from the authenticated request
    const { corePublicKey } = req.user;

    // Pass the owner's public key to ensure only their orders can be deleted
    return this.ordersService.batchRemove(batchDeleteDto, corePublicKey);
  }


  @Post()
  @ApiOperation({ summary: 'Create a new rune order' })
  @ApiResponse({ status: 201, description: 'The order has been successfully created.' })
  @ApiResponse({ status: 401, description: 'Invalid signatures or authentication headers' })
  create(@Req() req: AuthenticatedRequest, @Body() createOrderDto: CreateRuneOrderDto) {
    // Access the verified public keys
    const { nostrPublicKey, corePublicKey, address } = req.user;

    const order = {
      ...createOrderDto,
      id: createOrderDto.uuid,
      makerNostrKey: nostrPublicKey,
      makerPublicKey: corePublicKey,
      makerAddress: address
    }

    // Pass them to the service
    return this.ordersService.create(order);
  }

}

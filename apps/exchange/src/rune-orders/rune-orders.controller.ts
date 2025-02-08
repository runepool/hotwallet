import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RuneOrdersService } from './rune-orders.service';
import { CreateRuneOrderDto, UpdateRuneOrderDto } from './dto/rune-orders.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Rune Orders')
@Controller('rune-orders')
export class RuneOrdersController {
  constructor(private readonly ordersService: RuneOrdersService) { }

  @Post()
  create(@Body() createOrderDto: CreateRuneOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateRuneOrderDto) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}

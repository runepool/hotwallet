import { Controller, Get } from '@nestjs/common';
import { ExchangeService } from './exchange.service';

@Controller()
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @Get()
  getHello(): string {
    return this.exchangeService.getHello();
  }
}

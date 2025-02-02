import { Injectable } from '@nestjs/common';

@Injectable()
export class ExchangeService {
  getHello(): string {
    return 'Hello World!';
  }
}

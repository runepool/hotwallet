import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeController } from './exchange.controller';
import { ExchangeService } from './exchange.service';

describe('ExchangeController', () => {
  let exchangeController: ExchangeController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeController],
      providers: [ExchangeService],
    }).compile();

    exchangeController = app.get<ExchangeController>(ExchangeController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(exchangeController.getHello()).toBe('Hello World!');
    });
  });
});

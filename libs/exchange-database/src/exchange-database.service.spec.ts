import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeDatabaseService } from './exchange-database.service';

describe('ExchangeDatabaseService', () => {
  let service: ExchangeDatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangeDatabaseService],
    }).compile();

    service = module.get<ExchangeDatabaseService>(ExchangeDatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

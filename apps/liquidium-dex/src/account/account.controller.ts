import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountService } from './account.service';

@ApiTags('Account')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get the wallet balance' })
  @ApiResponse({ status: 200, description: 'The wallet balance was successfully retrieved.' })
  @ApiResponse({ status: 500, description: 'An error occurred while fetching the wallet balance.' })
  async getBalance() {
    return await this.accountService.getBalance();
  }
}

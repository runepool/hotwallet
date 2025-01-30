import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { SplitAssetDto } from './dto/split-asset.dto';

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

  @Get('liquidity-health')
  @ApiOperation({ summary: 'Get the account liquidity health' })
  @ApiResponse({ status: 200, description: 'The liquidity health was successfully retrieved.' })
  @ApiResponse({ status: 500, description: 'An error occurred while fetching the liquidity health.' })
  async getLiquidityHealth() {
    return await this.accountService.getLiquidityHealth();
  }

  @Post('split-asset')
  @ApiOperation({ summary: 'Split an asset into multiple UTXOs' })
  @ApiResponse({ status: 200, description: 'The asset was successfully split.' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters.' })
  @ApiResponse({ status: 500, description: 'An error occurred while splitting the asset.' })
  async splitAsset(@Body() splitAssetDto: SplitAssetDto) {
    return await this.accountService.splitAsset(
      splitAssetDto.asset_name,
      splitAssetDto.splits,
      splitAssetDto.amount_per_split
    );
  }
}

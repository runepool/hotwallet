import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { SplitAssetDto } from './dto/split-asset.dto';
import { AutoSplitConfigDto } from './dto/auto-split-config.dto';

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

  @Post('auto-split')
  @ApiOperation({ summary: 'Set auto split configuration for an asset' })
  @ApiResponse({ status: 200, description: 'Auto split configuration was successfully set.' })
  @ApiResponse({ status: 400, description: 'Invalid configuration parameters.' })
  @ApiResponse({ status: 500, description: 'An error occurred while setting auto split configuration.' })
  async setAutoSplitStrategy(@Body() config: AutoSplitConfigDto) {
    return await this.accountService.setAutoSplitStrategy({
      assetName: config.asset_name,
      enabled: config.enabled,
      maxCost: config.max_cost,
      splitSize: config.split_size
    });
  }

  @Get('auto-split/:assetName')
  @ApiOperation({ summary: 'Get auto split configuration for an asset' })
  @ApiResponse({ status: 200, description: 'Auto split configuration was successfully retrieved.' })
  @ApiResponse({ status: 404, description: 'Configuration not found for the asset.' })
  async getAutoSplitStrategy(@Param('assetName') assetName: string) {
    const config = await this.accountService.getAutoSplitStrategy(assetName);
    if (!config) {
      return null;
    }
    return {
      asset_name: config.assetName,
      enabled: config.enabled,
      max_cost: config.maxCost,
      split_size: config.splitSize
    };
  }

  @Get('auto-split')
  @ApiOperation({ summary: 'Get all auto split configurations' })
  @ApiResponse({ status: 200, description: 'Auto split configurations were successfully retrieved.' })
  async getAllAutoSplitStrategies() {
    const configs = await this.accountService.getAllAutoSplitStrategies();
    return configs.map(config => ({
      asset_name: config.assetName,
      enabled: config.enabled,
      max_cost: config.maxCost,
      split_size: config.splitSize
    }));
  }

  @Delete('auto-split/:assetName')
  @ApiOperation({ summary: 'Remove auto split configuration for an asset' })
  @ApiResponse({ status: 200, description: 'Auto split configuration was successfully removed.' })
  @ApiResponse({ status: 404, description: 'Configuration not found for the asset.' })
  async removeAutoSplitStrategy(@Param('assetName') assetName: string) {
    return await this.accountService.removeAutoSplitStrategy(assetName);
  }
}

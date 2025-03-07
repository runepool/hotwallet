import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutoRebalanceConfigDto, AutoRebalanceResponseDto } from '@app/database/auto-rebalance/dto/auto-rebalance.dto';
import { RebalanceService } from './rebalance.service';


@ApiTags('rebalance')
@Controller('rebalance')
export class RebalanceController {
  constructor(private readonly rebalanceService: RebalanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get all auto rebalance configurations' })
  @ApiResponse({ status: 200, description: 'Returns all auto rebalance configurations', type: [AutoRebalanceResponseDto] })
  async getAll(): Promise<AutoRebalanceResponseDto[]> {
    return this.rebalanceService.getAll();
  }

  @Get(':assetName')
  @ApiOperation({ summary: 'Get auto rebalance configuration for a specific asset' })
  @ApiParam({ name: 'assetName', description: 'Asset name', example: 'RUNE' })
  @ApiResponse({ status: 200, description: 'Returns the auto rebalance configuration for the specified asset', type: AutoRebalanceResponseDto })
  @ApiResponse({ status: 404, description: 'Auto rebalance configuration not found for the specified asset' })
  async get(@Param('assetName') assetName: string): Promise<AutoRebalanceResponseDto> {
    return this.rebalanceService.get(assetName);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new auto rebalance configuration' })
  @ApiResponse({ status: 201, description: 'Auto rebalance configuration created successfully', type: AutoRebalanceResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() dto: AutoRebalanceConfigDto): Promise<AutoRebalanceResponseDto> {
    return this.rebalanceService.set(dto);
  }

  @Put(':assetName')
  @ApiOperation({ summary: 'Update an existing auto rebalance configuration' })
  @ApiParam({ name: 'assetName', description: 'Asset name', example: 'RUNE' })
  @ApiResponse({ status: 200, description: 'Auto rebalance configuration updated successfully', type: AutoRebalanceResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Auto rebalance configuration not found for the specified asset' })
  async update(
    @Param('assetName') assetName: string,
    @Body() dto: AutoRebalanceConfigDto,
  ): Promise<AutoRebalanceResponseDto> {
    return this.rebalanceService.set({ ...dto, assetName });
  }

  @Delete(':assetName')
  @ApiOperation({ summary: 'Delete an auto rebalance configuration' })
  @ApiParam({ name: 'assetName', description: 'Asset name', example: 'RUNE' })
  @ApiResponse({ status: 200, description: 'Auto rebalance configuration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Auto rebalance configuration not found for the specified asset' })
  async remove(@Param('assetName') assetName: string): Promise<{ success: boolean }> {
    const success = await this.rebalanceService.remove(assetName);
    return { success };
  }
}

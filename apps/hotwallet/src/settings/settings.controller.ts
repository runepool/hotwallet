import { Controller, Get, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';


export class UserSettings {
  bitcoinPrivateKey: string;
  ordUrl: string;
  nostrRelays: string[];
  nostrPrivateKey: string;
  nostrPublicKey: string; // Derived from private key, read-only
}


@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user settings' })
  @ApiResponse({ status: 200, description: 'Returns the user settings', type: UserSettings })
  async getSettings(): Promise<UserSettings> {
    return this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(@Body() settings: UserSettings): Promise<void> {
    await this.settingsService.updateSettings(settings);
  }
}

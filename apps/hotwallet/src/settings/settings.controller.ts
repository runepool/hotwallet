import { Controller, Get, Put, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { SettingsService } from './settings.service';


export class UserSettings {
  bitcoinPrivateKey: string;
  ordUrl: string;
  websocketUrl: string;
  hasPassword?: boolean;
}

export class PasswordSetupDto {
  password: string;
  bitcoinPrivateKey?: string;
  oldPassword?: string;
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
  async updateSettings(
    @Body() settings: UserSettings,
  ): Promise<void> {
    await this.settingsService.updateSettings(settings);
  }

  @Post('password')
  @ApiOperation({ summary: 'Set up or change password' })
  @ApiResponse({ status: 200, description: 'Password set up successfully' })
  async setupPassword(@Body() passwordDto: PasswordSetupDto): Promise<void> {
    await this.settingsService.setupPassword(passwordDto.password, passwordDto.bitcoinPrivateKey, passwordDto.oldPassword);
  }

  @Post('unlock')
  @ApiOperation({ summary: 'Unlock wallet with password' })
  @ApiResponse({ status: 200, description: 'Wallet unlocked successfully' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async unlockWallet(@Body() unlockDto: { password: string }): Promise<{ success: boolean }> {
    const isValid = await this.settingsService.validatePassword(unlockDto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid password');
    }
    return { success: true };
  }
}


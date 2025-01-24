import { BitcoinWalletService } from '@app/wallet';
import { Injectable } from '@nestjs/common';


@Injectable()
export class AccountService {
  constructor(private readonly bitcoinWalletService: BitcoinWalletService) {}

  async getBalance(): Promise<{ address: string; balance: number }> {
    const walletInfo = this.bitcoinWalletService.generateP2TRAddress();

    // Mocking the balance fetching. Replace with actual balance API logic.
    const mockBalance = 0.12345; // Replace this with actual logic

    return {
      address: walletInfo.address,
      balance: mockBalance,
    };
  }
}

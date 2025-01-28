import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable, Logger } from '@nestjs/common';


@Injectable()
export class AccountService {
  constructor(
    private readonly ordService: OrdClient,
    private readonly bitcoinWalletService: BitcoinWalletService) { }

  async getBalance(): Promise<{ address: string; balance: number, token: string }[]> {
    const btcBalance = {
      address: '',
      balance: 0,
      token: "BTC",
      decimals: 8
    }
    let address;
    try {
      address = await this.bitcoinWalletService.getAddress();
      if (!address) {
        return [btcBalance];
      }

      const utxos = await this.ordService.address(address);
      btcBalance.address = address;
      btcBalance.balance = utxos.satBalance / 1e8;
      const runeBalances = {}
      utxos.runeBalances.forEach(runeBalance => {
        runeBalances[runeBalance.name] = {
          address,
          balance: runeBalance.amount,
          token: runeBalance.name,
        }
      });
    
      const result = [btcBalance];
      result.push(...Object.values(runeBalances) as any);
      return result;
    }
    catch (error) {
      Logger.error(error);
      return [btcBalance];
    }
  }

}

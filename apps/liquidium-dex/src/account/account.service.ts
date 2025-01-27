import { OrdClient } from '@app/blockchain/common/ord-client/client';
import { BitcoinWalletService } from '@app/wallet';
import { Injectable } from '@nestjs/common';


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

      btcBalance.address = address;
      const utxos = await this.ordService.address(address);
      const outputs = await this.ordService.outputBatch(utxos);

      const runeBalances = {}
      for (const output of outputs) {
        btcBalance.balance += output.value;
        for (const [rune, amount] of Object.entries(output.runes)) {
          if (!runeBalances[rune]) {
            runeBalances[rune] = {
              address,
              balance: amount.amount,
              token: rune,
              decimals: amount.divisibility
            }
            continue;
          }

          runeBalances[rune].balance += amount.amount
        }
      }

      const result = [btcBalance];
      result.push(...Object.values(runeBalances) as any);
      return result;
    }
    catch (error) {
      return [btcBalance];
    }
  }

}

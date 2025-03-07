import { RunesService } from '@app/blockchain/runes/runes.service';
import { RuneEngineService } from '@app/engine';
import { SelectedOrder } from '@app/engine/types';
import { RuneOrder } from '@app/exchange-database/entities/rune-order.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Errors, OracleError } from 'libs/errors/errors';
import { GetQuoteDto, QuoteResponseDto } from '../dto/quote.dto';

@Injectable()
export class QuoteService {
  constructor(
    private readonly engine: RuneEngineService,
    private readonly runeService: RunesService
  ) { }

  async getQuote(quoteDto: GetQuoteDto): Promise<QuoteResponseDto> {
    const { from, to, amount } = quoteDto;
    const fromAmount = BigInt(amount);

    // Determine if we're buying or selling runes
    const isBuyingRunes = from === 'BTC';
    const runeInfo = isBuyingRunes ? await this.runeService.getRuneInfo(to) : await this.runeService.getRuneInfo(from);

    let orders: SelectedOrder[] = [];
    let hasLiquidity = true;
    let toAmount = 0n;
    try {
      if (isBuyingRunes) {
        if (BigInt(amount) < 1000n) {
          throw new OracleError(Errors.QUOTE_AMOUNT_LESS_THAN_DUST)
        }
        const { runeAmount, selectedOrders } = await this.engine.reserveAskOrders(BigInt(amount), runeInfo);
        orders = selectedOrders;
        toAmount = runeAmount;
      } else {
        const { quoteAmount, selectedOrders } = await this.engine.reserveBidOrders(BigInt(amount), runeInfo);
        if (quoteAmount < 1000n) {
          throw new OracleError(Errors.QUOTE_AMOUNT_LESS_THAN_DUST)
        }
        orders = selectedOrders;
        toAmount = quoteAmount;
      }
    } catch (error) {
      if (error.code === Errors.INSUFFICIENT_FUNDS.code) {
        hasLiquidity = false;
      } else {
        throw error;
      }
    }


    // Calculate average price
    let avgPrice = Number(orders.reduce((prev, curr) => prev + BigInt(curr.order.price), 0n)) / orders.length;

    return {
      from,
      to,
      fromAmount: (amount).toString(),
      price: avgPrice.toString(),
      toAmount: toAmount.toString(),
      hasLiquidity,
      orders
    };
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus, RuneOrder, RuneOrderType } from '@app/exchange-database/entities/rune-order.entity';
import { GetQuoteDto, QuoteResponseDto, OrderQuote } from '../dto/quote.dto';
import { RunesService } from '@app/blockchain/runes/runes.service';
import Decimal from 'decimal.js';
import { Errors, OracleError } from 'libs/errors/errors';

@Injectable()
export class QuoteService {
  constructor(
    @InjectRepository(RuneOrder)
    private readonly runeOrderRepository: Repository<RuneOrder>,
    private readonly runeService: RunesService
  ) { }

  async getQuote(quoteDto: GetQuoteDto): Promise<QuoteResponseDto> {
    const { from, to, amount } = quoteDto;
    const fromAmount = BigInt(amount);

    // Determine if we're buying or selling runes
    const isBuyingRunes = from === 'BTC';
    const orderType = isBuyingRunes ? RuneOrderType.ASK : RuneOrderType.BID;
    const runeInfo = isBuyingRunes ? await this.runeService.getRuneInfo(to) : await this.runeService.getRuneInfo(from);

    // Get all open orders for this rune
    const orders = await this.runeOrderRepository.find({
      where: {
        rune: isBuyingRunes ? to : from,
        type: orderType,
        status: OrderStatus.OPEN
      },
      order: {
        // For buys, get lowest prices first. For sells, get highest prices first
        price: isBuyingRunes ? 'ASC' : 'DESC'
      }
    });

    if (orders.length === 0) {
      throw new BadRequestException('No liquidity available for this pair');
    }

    let remainingFromAmount = fromAmount;
    const usedOrders: OrderQuote[] = [];
    let totalToAmount = 0n;
    // Fill orders until we've used up the from amount
    for (const order of orders) {
      const availableAmount = order.quantity - order.filledQuantity;
      if (availableAmount <= 0n) continue;

      let orderFromAmount: bigint;
      let orderToAmount: bigint;

      if (isBuyingRunes) {
        if (remainingFromAmount <= 1000) {
          throw new OracleError(Errors.BASE_AMOUNT_LESS_THAN_DUST)
        }
        // Converting BTC to Runes
        orderFromAmount = BigInt(new Decimal((availableAmount * order.price).toString()).div(10 ** runeInfo.decimals).floor().toFixed(0));
        if (orderFromAmount > remainingFromAmount) {
          orderFromAmount = remainingFromAmount;
          orderToAmount = BigInt(new Decimal(orderFromAmount.toString()).mul(10 ** runeInfo.decimals).div(order.price.toString()).toFixed(0));
        } else {
          orderToAmount = availableAmount;
        }
      } else {
        // Converting Runes to BTC
        if (availableAmount > remainingFromAmount) {
          orderToAmount = BigInt(remainingFromAmount) * BigInt(order.price);
          orderFromAmount = remainingFromAmount;
        } else {
          orderToAmount = BigInt(availableAmount) * BigInt(order.price);
          orderFromAmount = availableAmount;
        }
      }

      if (orderFromAmount > 0n) {
        remainingFromAmount -= orderFromAmount;
        totalToAmount += orderToAmount;

        usedOrders.push({
          id: order.id,
          fromAmount: orderFromAmount.toString(),
          toAmount: orderToAmount.toString(),
          price: order.price.toString()
        });
      }

      if (remainingFromAmount <= 0n) break;
    }


    // Check if we have enough liquidity
    const hasLiquidity = remainingFromAmount <= 0n;

    // Calculate average price
    let avgPrice = Number(usedOrders.reduce((prev, curr) => prev + BigInt(curr.price), 0n)) / usedOrders.length;


    if (!isBuyingRunes) {
      if (totalToAmount < 1000n) {
        throw new OracleError(Errors.QUOTE_AMOUNT_LESS_THAN_DUST)
      }
    } else {
      if (fromAmount - remainingFromAmount < 1000n) {
        throw new OracleError(Errors.QUOTE_AMOUNT_LESS_THAN_DUST)
      }
    }

    return {
      from,
      to,
      fromAmount: (fromAmount - remainingFromAmount).toString(),
      price: avgPrice.toString(),
      toAmount: totalToAmount.toString(),
      hasLiquidity,
      orders: usedOrders
    };
  }
}

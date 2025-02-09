import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetQuoteDto, QuoteResponseDto } from '../dto/quote.dto';
import { QuoteService } from './quote.service';

@ApiTags('Quote')
@Controller('quote')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Get()
  @ApiOperation({ summary: 'Get a quote for swapping tokens' })
  @ApiResponse({
    status: 200,
    description: 'Returns a quote with price and liquidity information',
    type: QuoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or no liquidity available',
  })
  async getQuote(@Query() quoteDto: GetQuoteDto): Promise<QuoteResponseDto> {
    return this.quoteService.getQuote(quoteDto);
  }
}

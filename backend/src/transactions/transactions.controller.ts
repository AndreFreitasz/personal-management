import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CategorizeTransactionDto,
  CreateTransactionDto,
  DuplicateTransactionDto,
  ListTransactionsQueryDto,
  PagedTransactionsDto,
  TransactionResponseDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<PagedTransactionsDto> {
    const page = await this.transactions.list(userId, query);
    return {
      items: page.items.map((transaction) => TransactionResponseDto.from(transaction)),
      nextCursor: page.nextCursor,
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return TransactionResponseDto.from(await this.transactions.findOne(userId, id));
  }

  @Get(':id/audit')
  audit(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactions.auditTrail(userId, id);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return TransactionResponseDto.from(await this.transactions.create(userId, dto));
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return TransactionResponseDto.from(await this.transactions.update(userId, id, dto));
  }

  @Post(':id/categorize')
  @HttpCode(HttpStatus.OK)
  async categorize(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CategorizeTransactionDto,
  ): Promise<TransactionResponseDto> {
    return TransactionResponseDto.from(
      await this.transactions.categorize(userId, id, dto.categoryId ?? null),
    );
  }

  @Post(':id/duplicate')
  async duplicate(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return TransactionResponseDto.from(await this.transactions.duplicate(userId, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.transactions.remove(userId, id);
  }
}

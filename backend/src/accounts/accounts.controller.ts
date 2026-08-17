import {
  Body,
  Controller,
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
import { AccountsService } from './accounts.service';
import {
  AccountResponseDto,
  CreateAccountDto,
  ListAccountsQueryDto,
  UpdateAccountDto,
  WalletSummaryDto,
} from './dto/account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Query() query: ListAccountsQueryDto,
  ): Promise<AccountResponseDto[]> {
    const found = await this.accounts.list(userId, query.includeArchived ?? false);

    if (!query.withBalance) {
      return found.map((account) => AccountResponseDto.from(account));
    }

    const balances = await this.accounts.balancesOf(userId);
    return found.map((account) => AccountResponseDto.from(account, balances.get(account.id) ?? 0));
  }

  @Get('wallet')
  async wallet(@CurrentUser('id') userId: string): Promise<WalletSummaryDto> {
    const { balance, accounts, balances } = await this.accounts.wallet(userId);

    return {
      balance,
      currency: accounts[0]?.currency ?? 'BRL',
      accounts: accounts.map((account) =>
        AccountResponseDto.from(account, balances.get(account.id) ?? 0),
      ),
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    const account = await this.accounts.getOwned(userId, id);
    return AccountResponseDto.from(account, await this.accounts.balanceOf(userId, id));
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.create(userId, dto));
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.update(userId, id, dto));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountResponseDto> {
    return AccountResponseDto.from(await this.accounts.archive(userId, id));
  }
}

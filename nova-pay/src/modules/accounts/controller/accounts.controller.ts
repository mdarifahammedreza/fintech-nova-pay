import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type JwtRequestUser,
} from '../../../infrastructure/auth/jwt-auth.guard';
import { CreateAccountHandler } from '../command/handlers/create-account.handler';
import { CreateAccountCommand } from '../command/impl/create-account.command';
import {
  AccountBalanceResponseDto,
  toAccountBalanceResponseDto,
} from '../dto/account-balance-response.dto';
import { CreateAccountDto } from '../dto/create-account.dto';
import { Account } from '../entities/account.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { Currency } from '../enums/currency.enum';
import { GetAccountBalanceHandler } from '../query/handlers/get-account-balance.handler';
import { GetAccountByIdHandler } from '../query/handlers/get-account-by-id.handler';
import { GetUserAccountsHandler } from '../query/handlers/get-user-accounts.handler';
import { GetAccountBalanceQuery } from '../query/impl/get-account-balance.query';
import { GetAccountByIdQuery } from '../query/impl/get-account-by-id.query';
import { GetUserAccountsQuery } from '../query/impl/get-user-accounts.query';

/** API shape for Swagger (mirrors persisted account row). */
export class AccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  accountNumber: string;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ description: 'Ledger projection snapshot' })
  balance: string;

  @ApiProperty({ description: 'Spendable projection' })
  availableBalance: string;

  @ApiProperty({ enum: AccountStatus })
  status: AccountStatus;

  @ApiProperty()
  overdraftLimit: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

function toAccountResponse(account: Account): AccountResponseDto {
  return {
    id: account.id,
    userId: account.userId,
    accountNumber: account.accountNumber,
    currency: account.currency,
    balance: account.balance,
    availableBalance: account.availableBalance,
    status: account.status,
    overdraftLimit: account.overdraftLimit,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

type AuthedRequest = Request & { user: JwtRequestUser };

/**
 * HTTP surface for the accounts bounded context.
 * JWT required. Read routes enforce `account.userId === jwt.sub` server-side.
 */
@Controller('accounts')
@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(
    private readonly createAccountHandler: CreateAccountHandler,
    private readonly getAccountByIdHandler: GetAccountByIdHandler,
    private readonly getAccountBalanceHandler: GetAccountBalanceHandler,
    private readonly getUserAccountsHandler: GetUserAccountsHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create account' })
  @ApiBody({ type: CreateAccountDto })
  @ApiOkResponse({ type: AccountResponseDto })
  async create(
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.createAccountHandler.execute(
      new CreateAccountCommand(dto),
    );
    return toAccountResponse(account);
  }

  @Get()
  @ApiOperation({ summary: 'List accounts for a user' })
  @ApiQuery({ name: 'userId', required: true, format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto, isArray: true })
  async listByUser(
    @Query('userId', ParseUUIDPipe) userId: string,
    @Req() req: AuthedRequest,
  ): Promise<AccountResponseDto[]> {
    const rows = await this.getUserAccountsHandler.execute(
      new GetUserAccountsQuery(userId, req.user.sub),
    );
    return rows.map(toAccountResponse);
  }

  @Get(':id/balance')
  @ApiOperation({
    summary: 'Get account balance projection',
    description:
      'Returns ledger-derived `balance` and `availableBalance` from the ' +
      'account row. Caller must own the account (`userId` = JWT `sub`).',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Account id' })
  @ApiOkResponse({ type: AccountBalanceResponseDto })
  async getBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<AccountBalanceResponseDto> {
    const view = await this.getAccountBalanceHandler.execute(
      new GetAccountBalanceQuery(id, req.user.sub),
    );
    if (!view) {
      throw new NotFoundException('Account not found');
    }
    return toAccountBalanceResponseDto(view);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: AccountResponseDto })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<AccountResponseDto> {
    const account = await this.getAccountByIdHandler.execute(
      new GetAccountByIdQuery(id, req.user.sub),
    );
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return toAccountResponse(account);
  }
}

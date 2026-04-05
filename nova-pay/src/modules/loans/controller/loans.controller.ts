import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  JwtAuthGuard,
  type JwtRequestUser,
} from '../../../infrastructure/auth/jwt-auth.guard';
import { ApplyLoanHandler } from '../command/handlers/apply-loan.handler';
import { DisburseLoanHandler } from '../command/handlers/disburse-loan.handler';
import { RepayLoanHandler } from '../command/handlers/repay-loan.handler';
import { ApplyLoanCommand } from '../command/impl/apply-loan.command';
import { DisburseLoanCommand } from '../command/impl/disburse-loan.command';
import { RepayLoanCommand } from '../command/impl/repay-loan.command';
import { ApplyLoanDto } from '../dto/apply-loan.dto';
import { DisburseLoanDto } from '../dto/disburse-loan.dto';
import { LoanResponseDto } from '../dto/loan-response.dto';
import { RepayLoanDto } from '../dto/repay-loan.dto';
import { GetLoanByIdHandler } from '../query/handlers/get-loan-by-id.handler';
import { GetLoanByIdQuery } from '../query/impl/get-loan-by-id.query';

type AuthedRequest = Request & { user: JwtRequestUser };

@Controller('loans')
@ApiTags('loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(
    private readonly applyLoanHandler: ApplyLoanHandler,
    private readonly disburseLoanHandler: DisburseLoanHandler,
    private readonly repayLoanHandler: RepayLoanHandler,
    private readonly getLoanByIdHandler: GetLoanByIdHandler,
  ) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply for a loan' })
  @ApiBody({ type: ApplyLoanDto })
  @ApiOkResponse({ type: LoanResponseDto })
  apply(
    @Body() dto: ApplyLoanDto,
    @Req() req: AuthedRequest,
  ): Promise<LoanResponseDto> {
    return this.applyLoanHandler.execute(
      new ApplyLoanCommand(dto, req.user.sub),
    );
  }

  @Post(':id/disburse')
  @ApiOperation({ summary: 'Disburse an approved loan to the borrower wallet' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: DisburseLoanDto })
  @ApiOkResponse({ type: LoanResponseDto })
  disburse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisburseLoanDto,
    @Req() req: AuthedRequest,
  ): Promise<LoanResponseDto> {
    return this.disburseLoanHandler.execute(
      new DisburseLoanCommand(id, dto, req.user.sub),
    );
  }

  @Post(':id/repay')
  @ApiOperation({ summary: 'Repay principal from borrower wallet' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RepayLoanDto })
  @ApiOkResponse({ type: LoanResponseDto })
  repay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RepayLoanDto,
    @Req() req: AuthedRequest,
  ): Promise<LoanResponseDto> {
    return this.repayLoanHandler.execute(
      new RepayLoanCommand(id, dto, req.user.sub),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan by id (borrower only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: LoanResponseDto })
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthedRequest,
  ): Promise<LoanResponseDto> {
    return this.getLoanByIdHandler.execute(
      new GetLoanByIdQuery(id, req.user.sub),
    );
  }
}

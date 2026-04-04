import { BadRequestException, Injectable } from '@nestjs/common';
import { Account } from '../../accounts/entities/account.entity';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { AccountsService } from '../../accounts/service/accounts.service';
import { CreatePayrollBatchDto } from '../dto/create-payroll-batch.dto';
import { ProcessPayrollBatchDto } from '../dto/process-payroll-batch.dto';
import { PayrollBatch } from '../entities/payroll-batch.entity';
import { PayrollItem } from '../entities/payroll-item.entity';
import { PayrollBatchStatus } from '../enums/payroll-batch-status.enum';
import { PayrollItemStatus } from '../enums/payroll-item-status.enum';

const SCALE = 10_000n;

/**
 * Batch / line business rules and account preconditions. No money movement.
 */
@Injectable()
export class PayrollValidationService {
  constructor(private readonly accounts: AccountsService) {}

  /**
   * Validates DTO shape-dependent rules, account readiness, currency
   * alignment, and that line amounts sum to `totalAmount`.
   */
  async assertCreateBatchValid(dto: CreatePayrollBatchDto): Promise<void> {
    const employer = await this.accounts.requireAccountById(
      dto.employerAccountId,
    );
    this.assertAccountActive(employer, 'Employer account');
    this.assertCurrency(employer, dto.currency, 'Employer account');

    const seenRefs = new Set<string>();
    let sum = 0n;
    for (const line of dto.items) {
      if (seenRefs.has(line.itemReference)) {
        throw new BadRequestException(
          `Duplicate itemReference in payload: ${line.itemReference}`,
        );
      }
      seenRefs.add(line.itemReference);

      const emp = await this.accounts.requireAccountById(
        line.employeeAccountId,
      );
      this.assertAccountActive(emp, 'Employee account');
      this.assertCurrency(emp, line.currency, 'Employee account');
      if (line.currency !== dto.currency) {
        throw new BadRequestException(
          'Item currency must match batch currency',
        );
      }
      sum += scaleAmount(line.amount);
    }

    const total = scaleAmount(dto.totalAmount);
    if (sum !== total) {
      throw new BadRequestException(
        'Sum of item amounts must equal batch totalAmount',
      );
    }
  }

  /**
   * Preconditions before funding / fanout (status guards only).
   */
  assertBatchReadyForProcessing(
    batch: PayrollBatch,
    items: PayrollItem[],
    _dto: ProcessPayrollBatchDto,
  ): void {
    if (batch.status !== PayrollBatchStatus.DRAFT) {
      throw new BadRequestException(
        `Batch ${batch.id} is not in DRAFT status`,
      );
    }
    if (items.length === 0) {
      throw new BadRequestException('Batch has no items to process');
    }
    const bad = items.filter((i) => i.status !== PayrollItemStatus.PENDING);
    if (bad.length > 0) {
      throw new BadRequestException(
        'All items must be PENDING before processing',
      );
    }
  }

  private assertAccountActive(account: Account, label: string): void {
    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        `${label} ${account.id} must be ACTIVE`,
      );
    }
  }

  private assertCurrency(
    account: Account,
    currency: string,
    label: string,
  ): void {
    if (account.currency !== currency) {
      throw new BadRequestException(
        `${label} currency does not match batch/line currency`,
      );
    }
  }
}

function scaleAmount(s: string): bigint {
  const t = s.trim();
  const m = /^(\d+)(?:\.(\d{0,4}))?$/.exec(t);
  if (!m) {
    throw new BadRequestException(`Invalid decimal amount: ${s}`);
  }
  const intPart = m[1];
  const fracRaw = m[2] ?? '';
  const frac = (fracRaw + '0000').slice(0, 4);
  return BigInt(intPart) * SCALE + BigInt(frac);
}

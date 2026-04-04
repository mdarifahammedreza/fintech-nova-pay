import { Controller } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Payroll HTTP surface — routes added when use cases are implemented.
 * TODO: `JwtAuthGuard` + employer / operator policy.
 */
@Controller('payroll')
@ApiTags('payroll')
@ApiBearerAuth()
export class PayrollController {}

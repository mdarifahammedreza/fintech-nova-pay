import { Injectable } from '@nestjs/common';
import { Payment } from '../../entities/payment.entity';
import { PaymentOrchestratorService } from '../../service/payment-orchestrator.service';
import { CreatePaymentCommand } from '../impl/create-payment.command';

@Injectable()
export class CreatePaymentHandler {
  constructor(
    private readonly orchestrator: PaymentOrchestratorService,
  ) {}

  execute(command: CreatePaymentCommand): Promise<Payment> {
    return this.orchestrator.submitPayment(command.dto);
  }
}

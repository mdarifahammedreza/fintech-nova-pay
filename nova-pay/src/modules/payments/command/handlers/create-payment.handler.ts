import {
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Payment } from '../../entities/payment.entity';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { PaymentOrchestratorService } from '../../service/payment-orchestrator.service';
import { CreatePaymentCommand } from '../impl/create-payment.command';

@Injectable()
export class CreatePaymentHandler {
  constructor(
    private readonly orchestrator: PaymentOrchestratorService,
  ) {}

  async execute(command: CreatePaymentCommand): Promise<Payment> {
    const payment = await this.orchestrator.submitPayment(
      command.dto,
      command.actorUserId,
    );
    if (payment.status === PaymentStatus.FAILED) {
      throw new UnprocessableEntityException({
        error: 'PAYMENT_FAILED',
        message:
          'Payment could not be completed; retries return the same outcome',
        paymentId: payment.id,
      });
    }
    return payment;
  }
}

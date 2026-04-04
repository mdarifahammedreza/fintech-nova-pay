import { Injectable } from '@nestjs/common';
import { Payment } from '../../entities/payment.entity';
import { PaymentsService } from '../../service/payments.service';
import { GetPaymentByReferenceQuery } from '../impl/get-payment-by-reference.query';

@Injectable()
export class GetPaymentByReferenceHandler {
  constructor(private readonly payments: PaymentsService) {}

  execute(query: GetPaymentByReferenceQuery): Promise<Payment | null> {
    return this.payments.findPaymentByReference(query.reference);
  }
}

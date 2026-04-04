import { Injectable } from '@nestjs/common';
import { Payment } from '../../entities/payment.entity';
import { PaymentsService } from '../../service/payments.service';
import { GetPaymentByIdQuery } from '../impl/get-payment-by-id.query';

@Injectable()
export class GetPaymentByIdHandler {
  constructor(private readonly payments: PaymentsService) {}

  execute(query: GetPaymentByIdQuery): Promise<Payment | null> {
    return this.payments.findPaymentById(query.id);
  }
}

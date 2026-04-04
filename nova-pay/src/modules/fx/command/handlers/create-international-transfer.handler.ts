import { Injectable } from '@nestjs/common';
import { InternationalTransferOrchestratorService } from '../../service/international-transfer-orchestrator.service';
import { CreateInternationalTransferCommand } from '../impl/create-international-transfer.command';

@Injectable()
export class CreateInternationalTransferHandler {
  constructor(
    private readonly orchestrator: InternationalTransferOrchestratorService,
  ) {}

  execute(command: CreateInternationalTransferCommand) {
    return this.orchestrator.executeInternationalTransfer(
      command.userId,
      command.dto,
    );
  }
}

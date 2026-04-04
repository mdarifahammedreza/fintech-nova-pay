import { BadRequestException } from '@nestjs/common';

/**
 * HTTP idempotency for mutating money APIs: `Idempotency-Key` must be present
 * and byte-identical to the chosen body field (e.g. `idempotencyKey`,
 * `correlationId`). Run after `ValidationPipe` so the body field is validated.
 */
export function assertIdempotencyKeyMatchesBodyField(
  headerValue: string | undefined,
  bodyValue: string,
  bodyFieldName: string,
): void {
  const h = headerValue?.trim();
  if (!h) {
    throw new BadRequestException('Idempotency-Key header is required');
  }
  if (h !== bodyValue) {
    throw new BadRequestException(
      `Idempotency-Key header must exactly match body ${bodyFieldName}`,
    );
  }
}

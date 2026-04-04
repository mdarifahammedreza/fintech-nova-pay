import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Basic request timing log. Extend with structured logging / tracing IDs
 * when observability module lands.
 */
@Injectable()
export class LoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const started = Date.now();
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      (req.headers['x-request-id'] as string | undefined);

    return next.handle().pipe(
      tap({
        finalize: () => {
          const ms = Date.now() - started;
          const suffix = correlationId ? ` [${correlationId}]` : '';
          this.logger.log(`${method} ${url} ${ms}ms${suffix}`);
        },
      }),
    );
  }
}

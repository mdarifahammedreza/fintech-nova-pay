import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type RequestWithIds = Request & {
  correlationId?: string;
};

/**
 * Maps HTTP and unknown errors to a stable JSON shape.
 * Assumes Express adapter.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithIds>();

    const correlationId = this.resolveCorrelationId(req);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const base =
        typeof raw === 'string'
          ? { message: raw }
          : { ...(raw as Record<string, unknown>) };
      res.status(status).json({
        ...base,
        statusCode: status,
        correlationId,
        path: req.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      correlationId,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveCorrelationId(req: RequestWithIds): string | undefined {
    if (req.correlationId) {
      return req.correlationId;
    }
    const h = req.headers;
    const a = h['x-correlation-id'];
    const b = h['x-request-id'];
    const v = (Array.isArray(a) ? a[0] : a) ?? (Array.isArray(b) ? b[0] : b);
    return typeof v === 'string' ? v : undefined;
  }
}

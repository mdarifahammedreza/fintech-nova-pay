import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Wraps successful handler results as `{ data: T }` unless the value is
 * already a plain object with its own `data` key (e.g. paginated payloads).
 * Skip wrapping for streams/buffers by returning raw bodies from handlers
 * that opt out (future: `@RawResponse()` if needed).
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (this.isAlreadyWrapped(body)) {
          return body;
        }
        return { data: body };
      }),
    );
  }

  private isAlreadyWrapped(body: unknown): boolean {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(body, 'data');
  }
}

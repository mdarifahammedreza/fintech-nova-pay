import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AppModule } from './app.module';

/**
 * Placeholder — replace with shared filter from common/filters when ready.
 */
@Catch()
class GlobalExceptionFilterPlaceholder implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilterPlaceholder.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res
        .status(status)
        .json(typeof body === 'object' ? body : { message: body });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}

/** Placeholder — replace with logging/metrics interceptor from common/. */
@Injectable()
class GlobalInterceptorPlaceholder implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle();
  }
}

function setupSwagger(app: import('@nestjs/common').INestApplication): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const cfg = new DocumentBuilder()
    .setTitle('NovaPay API')
    .setDescription('Modular monolith — fintech API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, cfg);
  SwaggerModule.setup('api', app, document);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilterPlaceholder());
  app.useGlobalInterceptors(new GlobalInterceptorPlaceholder());

  setupSwagger(app);

  const port = process.env.PORT ?? '3000';
  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});

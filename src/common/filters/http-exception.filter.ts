import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { RedactingLogger } from '../logging/redacting-logger';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new RedactingLogger(
    HttpExceptionFilter.name,
  );

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = this.getErrorName(statusCode);
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseBody = exceptionResponse as {
          message?: string | string[];
          error?: string;
        };

        if (responseBody.message !== undefined) {
          message = Array.isArray(responseBody.message)
            ? responseBody.message.join(', ')
            : responseBody.message;
        }

        error = this.getErrorName(statusCode);
      }
    } else {
      const originalMessage =
        exception instanceof Error
          ? exception.message
          : 'Unknown error';

      const stack =
        exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${originalMessage}`,
        stack,
      );

      const nodeEnv =
        this.configService.get<string>('NODE_ENV') ?? 'development';

      if (nodeEnv === 'development') {
        message = originalMessage;
      }
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getErrorName(statusCode: number): string {
    const statusText = HttpStatus[statusCode];

    if (!statusText) {
      return 'Error';
    }

    return statusText
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

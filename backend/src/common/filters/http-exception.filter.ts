import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      (exceptionResponse as any).error?.code &&
      (exceptionResponse as any).error?.message
    ) {
      // Already in desired shape
      return response.status(status).json(exceptionResponse);
    }

    const defaultMessage =
      (typeof exceptionResponse === 'string' && exceptionResponse) ||
      this.defaultMessageForStatus(status);

    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : undefined;

    const body = {
      error: {
        code: this.codeForStatus(status),
        message: defaultMessage,
        ...(details !== undefined ? { details } : {}),
      },
    };

    return response.status(status).json(body);
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'HTTP_ERROR';
    }
  }

  private defaultMessageForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad request.';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized.';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden.';
      case HttpStatus.NOT_FOUND:
        return 'Not found.';
      case HttpStatus.CONFLICT:
        return 'Conflict.';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Rate limit exceeded.';
      default:
        return 'Request failed.';
    }
  }
}


import { HttpException, HttpStatus } from '@nestjs/common';

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: any;
  };
};

function buildBody(code: string, message: string, details?: any): ErrorBody {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export function badRequest(
  code: string,
  message: string,
  details?: any,
): never {
  throw new HttpException(buildBody(code, message, details), HttpStatus.BAD_REQUEST);
}

export function unauthorized(code: string, message: string): never {
  throw new HttpException(buildBody(code, message), HttpStatus.UNAUTHORIZED);
}

export function forbidden(code: string, message: string): never {
  throw new HttpException(buildBody(code, message), HttpStatus.FORBIDDEN);
}

export function notFound(
  code: string,
  message: string,
  details?: any,
): never {
  throw new HttpException(buildBody(code, message, details), HttpStatus.NOT_FOUND);
}

export function conflict(
  code: string,
  message: string,
  details?: any,
): never {
  throw new HttpException(buildBody(code, message, details), HttpStatus.CONFLICT);
}


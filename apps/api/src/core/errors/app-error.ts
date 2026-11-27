import { ErrorCodes, type ErrorCode } from './error-codes.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: ErrorCode = ErrorCodes.INTERNAL,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Permintaan tidak valid', code: ErrorCode = ErrorCodes.BAD_REQUEST, details?: unknown) {
    return new AppError(400, message, code, details);
  }
  static unauthorized(message = 'Autentikasi diperlukan', code: ErrorCode = ErrorCodes.UNAUTHORIZED) {
    return new AppError(401, message, code);
  }
  static forbidden(message = 'Anda tidak memiliki akses', code: ErrorCode = ErrorCodes.FORBIDDEN) {
    return new AppError(403, message, code);
  }
  static notFound(message = 'Data tidak ditemukan') {
    return new AppError(404, message, ErrorCodes.NOT_FOUND);
  }
  static conflict(message = 'Data konflik', code: ErrorCode = ErrorCodes.CONFLICT) {
    return new AppError(409, message, code);
  }
  static unprocessable(message: string, code: ErrorCode = ErrorCodes.UNPROCESSABLE, details?: unknown) {
    return new AppError(422, message, code, details);
  }
  static badGateway(message: string, details?: unknown) {
    return new AppError(502, message, ErrorCodes.BAD_GATEWAY, details);
  }
}

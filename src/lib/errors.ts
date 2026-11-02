export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 400,
    code = 'BAD_REQUEST',
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Sessão inválida ou expirada. Faça login novamente.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não possui permissão para realizar esta operação.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos enviados na requisição.', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito ou operação duplicada detectada.') {
    super(message, 409, 'CONFLICT');
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(
    message = 'Limite de utilização atingido. Regularize pendências na carteira ou resgate um cupom promocional para continuar.'
  ) {
    super(message, 402, 'INSUFFICIENT_CREDITS');
  }
}

export class RateLimitError extends AppError {
  constructor(
    message = 'Muitas requisições em pouco tempo. Aguarde alguns instantes e tente novamente.'
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

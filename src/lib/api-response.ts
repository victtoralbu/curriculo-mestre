import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { logger } from './logger';

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  logger.error('Erro inesperado na rota de API', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'Ocorreu um erro interno ao processar sua solicitação. Tente novamente em instantes.',
      },
    },
    { status: 500 }
  );
}

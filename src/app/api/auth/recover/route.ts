import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import {
  confirmPasswordReset,
  createPasswordResetRequest,
} from '@/modules/authentication/auth.service';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'request' | 'confirm';
      email?: string;
      token?: string;
      newPassword?: string;
    };

    if (body.action === 'confirm' && body.token && body.newPassword) {
      await confirmPasswordReset(body.token, body.newPassword);
      return NextResponse.json({
        ok: true,
        message: 'Senha redefinida com sucesso. Você já pode entrar na plataforma.',
      });
    }

    const result = await createPasswordResetRequest(body.email || '');
    return NextResponse.json({
      ok: true,
      message:
        'Se o e-mail informado estiver cadastrado, um código de recuperação foi gerado.',
      resetToken: result.resetToken,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

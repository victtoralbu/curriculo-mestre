import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  getOrInitOnboardingConversation,
  sendOnboardingMessage,
  uploadResumeInOnboarding,
} from '@/modules/onboarding/onboarding.service';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const session = await getOrInitOnboardingConversation(user.id);
    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Selecione um arquivo PDF ou DOCX para enviar.',
            },
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const session = await uploadResumeInOnboarding({
        userId: user.id,
        fileName: file.name,
        mimeType: file.type,
        buffer,
      });

      return NextResponse.json({
        ok: true,
        session,
      });
    }

    const body = (await req.json()) as {
      message?: string;
      actionId?: string;
    };

    const session = await sendOnboardingMessage({
      userId: user.id,
      message: body.message || '',
      actionId: body.actionId,
    });

    return NextResponse.json({
      ok: true,
      session,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

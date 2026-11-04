import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  sendApplicationChatMessage,
  startOrGetApplicationConversation,
} from '@/modules/onboarding/onboarding.service';
import { extractTextFromUploadedDocument } from '@/services/documents/document-export.service';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const conversationId = req.nextUrl.searchParams.get('conversationId');
    const forceNew = req.nextUrl.searchParams.get('new') === '1';

    const session = await startOrGetApplicationConversation({
      userId: user.id,
      conversationId,
      forceNew,
    });

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
      const conversationId = String(formData.get('conversationId') || '');
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Envie um arquivo PDF ou DOCX com o anúncio da vaga.',
            },
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const extractedText = await extractTextFromUploadedDocument(
        file.name,
        buffer
      );

      const session = await sendApplicationChatMessage({
        userId: user.id,
        conversationId,
        message: extractedText,
      });

      return NextResponse.json({
        ok: true,
        session,
      });
    }

    const body = (await req.json()) as {
      conversationId?: string;
      message?: string;
      actionId?: string;
    };

    const session = await sendApplicationChatMessage({
      userId: user.id,
      conversationId: body.conversationId || '',
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

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import { extractTextFromUploadedDocument } from '@/services/documents/document-export.service';
import { structureImportedResumeText } from '@/services/gemini/gemini.service';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const contentType = req.headers.get('content-type') || '';

    let rawText = '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        rawText = await extractTextFromUploadedDocument(file.name, buffer);
      } else {
        rawText = String(formData.get('text') || '');
      }
    } else {
      const body = (await req.json()) as { text?: string };
      rawText = body.text || '';
    }

    const result = await structureImportedResumeText(user.id, rawText);
    return NextResponse.json({
      ok: true,
      suggestedProfile: result.suggestedProfile,
      notice:
        'Revise os dados extraídos abaixo. Suas informações atuais não foram sobrescritas automaticamente — confirme apenas o que desejar salvar.',
    });
  } catch (err) {
    return handleApiError(err);
  }
}

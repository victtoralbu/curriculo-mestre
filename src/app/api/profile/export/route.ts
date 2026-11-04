import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { ValidationError } from '@/lib/errors';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import { getOrCreateProfileByUserId } from '@/modules/professional-profile/profile.service';
import {
  buildMasterResumeContentFromProfile,
  generateResumeDocxBuffer,
  generateResumePdfBuffer,
} from '@/services/documents/document-export.service';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const format = (
      req.nextUrl.searchParams.get('format') || 'pdf'
    ).toLowerCase();

    const profile = await getOrCreateProfileByUserId(user.id);
    if (!profile.isComplete) {
      throw new ValidationError(
        'Conclua todas as seções do seu Currículo Mestre na conversa com a IA antes de exportar.'
      );
    }

    const masterResume = buildMasterResumeContentFromProfile(profile);
    const safeName = (profile.full_name || 'Profissional')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    if (format === 'docx') {
      const buffer = await generateResumeDocxBuffer(masterResume);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="Curriculo_Mestre_${safeName}.docx"`,
        },
      });
    }

    const pdfBuffer = await generateResumePdfBuffer(masterResume);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Curriculo_Mestre_${safeName}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

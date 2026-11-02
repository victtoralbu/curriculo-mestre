import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import { getApplicationByIdForUser } from '@/modules/resume-generation/application.service';
import {
  generateResumeDocxBuffer,
  generateResumePdfBuffer,
} from '@/services/documents/document-export.service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const format = (
      req.nextUrl.searchParams.get('format') || 'pdf'
    ).toLowerCase();

    const application = await getApplicationByIdForUser(user.id, id);
    const safePosition = application.position
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    if (format === 'docx') {
      const buffer = await generateResumeDocxBuffer(application.resume_content);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="Curriculo_Mestre_${safePosition}.docx"`,
        },
      });
    }

    const pdfBuffer = await generateResumePdfBuffer(application.resume_content);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Curriculo_Mestre_${safePosition}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

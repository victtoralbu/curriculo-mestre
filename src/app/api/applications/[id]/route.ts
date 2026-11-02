import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  ApplicationStatus,
  getApplicationByIdForUser,
  updateApplicationForUser,
} from '@/modules/resume-generation/application.service';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const application = await getApplicationByIdForUser(user.id, id);
    return NextResponse.json({ ok: true, application });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await context.params;
    const body = (await req.json()) as {
      status?: ApplicationStatus;
      resumeContent?: unknown;
    };

    const application = await updateApplicationForUser({
      userId: user.id,
      applicationId: id,
      status: body.status,
      resumeContent: body.resumeContent,
    });

    return NextResponse.json({ ok: true, application });
  } catch (err) {
    return handleApiError(err);
  }
}

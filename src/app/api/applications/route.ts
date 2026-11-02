import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  createApplicationAndGenerateResume,
  listUserApplications,
} from '@/modules/resume-generation/application.service';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const applications = await listUserApplications(user.id);
    return NextResponse.json({ ok: true, applications });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await req.json();
    const application = await createApplicationAndGenerateResume({
      userId: user.id,
      rawInput: body,
    });
    return NextResponse.json({ ok: true, application }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

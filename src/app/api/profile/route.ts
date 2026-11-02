import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-response';
import { requireAuthenticatedUser } from '@/modules/authentication/auth.service';
import {
  getOrCreateProfileByUserId,
  saveFullProfessionalProfile,
} from '@/modules/professional-profile/profile.service';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const profile = await getOrCreateProfileByUserId(user.id);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const body = await req.json();
    const profile = await saveFullProfessionalProfile(user.id, body);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return handleApiError(err);
  }
}

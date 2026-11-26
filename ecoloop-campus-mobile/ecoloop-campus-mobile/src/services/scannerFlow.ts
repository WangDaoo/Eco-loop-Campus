import type { RecyclingSubmission, UserProfile } from '../types';

type SubmissionLike = Pick<RecyclingSubmission, 'binId' | 'status' | 'expiredAt' | 'verifiedBy'>;

function timeOf(value: Date | string | undefined) {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function isSubmissionQrExpired(submission: Pick<RecyclingSubmission, 'expiredAt'>, now = new Date()) {
  const expiresAt = timeOf(submission.expiredAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

/**
 * A volunteer may only confirm, reject or request review for a QR they scanned themselves
 * (the backend raises SUBMISSION_ACTOR_MISMATCH otherwise). Admins may act on any submission.
 */
export function canVolunteerActOnSubmission(
  submission: Pick<RecyclingSubmission, 'verifiedBy'>,
  volunteer: Pick<UserProfile, 'id' | 'role'>
) {
  if (volunteer.role === 'admin') return true;
  return !submission.verifiedBy || submission.verifiedBy === volunteer.id;
}

/**
 * Submissions still waiting at the volunteer's duty station.
 * CREATED codes disappear once their QR expires (the backend will refuse them),
 * while QR_SCANNED ones stay so the volunteer can finish the review they started.
 */
export function getPendingDutySubmissions<T extends SubmissionLike>(submissions: T[], dutyStationId: string, now = new Date()) {
  if (!dutyStationId) return [];
  return submissions.filter(item => {
    if (item.binId !== dutyStationId) return false;
    if (item.status === 'QR_SCANNED') return true;
    return item.status === 'CREATED' && !isSubmissionQrExpired(item, now);
  });
}

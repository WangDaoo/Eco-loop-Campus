import { RecyclingSubmission } from '../types';

export function missionIdsForSubmission(submission: RecyclingSubmission) {
  const missionIds = ['submit-3'];
  if (submission.wasteTypeId === 'paper') missionIds.push('paper-week');
  return missionIds;
}

export function missionIdsForFeedback() {
  return ['feedback-good'];
}

import { MobileInitialData, SupabaseMobileStore } from './supabaseMobileStore';
import { UserProfile } from '../types';

type TestAccount = {
  email: string;
  password: string;
};

export type SupabaseWriteSmokeResult = {
  submissionId: string;
  predictionId: string;
  qrToken: string;
  proofId: string;
  points: number;
};

export async function runSupabaseWriteSmoke(
  store: Pick<
    SupabaseMobileStore,
    'createSubmission' | 'saveAiPrediction' | 'signOut' | 'signIn' | 'markSubmissionScanned' | 'attachProofImage' | 'confirmSubmission'
  >,
  student: UserProfile,
  data: MobileInitialData,
  volunteerAccount: TestAccount
): Promise<SupabaseWriteSmokeResult> {
  const station = data.stations[0];
  const wasteType = data.wasteTypes[0];
  if (!station) throw new Error('Smoke write can it nhat 1 tram bins');
  if (!wasteType) throw new Error('Smoke write can it nhat 1 waste_types');

  const submission = await store.createSubmission(student.id, {
    binId: station.id,
    wasteTypeId: wasteType.id,
    quantity: 1
  }, data.wasteTypes);

  const prediction = await store.saveAiPrediction(student.id, {
    className: wasteType.id,
    confidence: 0.9,
    source: 'upload',
    binId: station.id,
    imageName: 'smoke-ai-prediction.jpg'
  });

  await store.signOut();
  const volunteer = await store.signIn('volunteer', volunteerAccount.email, volunteerAccount.password);
  const scanned = await store.markSubmissionScanned(submission.qrToken, volunteer.id, station.id);
  if (scanned.result !== 'SUCCESS' || !scanned.submission) throw new Error(`Smoke write khong scan duoc QR ${submission.qrToken}: ${scanned.result}`);

  const proof = await store.attachProofImage(submission.id, {
    imageUrl: 'https://placehold.co/640x480.jpg?text=Eco-loop+Smoke+Proof',
    note: 'Smoke E2E proof image'
  });
  const confirmed = await store.confirmSubmission(submission.id, 1, volunteer.id, 'Smoke E2E volunteer confirmation', data.wasteTypes);

  return {
    submissionId: submission.id,
    predictionId: prediction.id,
    qrToken: submission.qrToken,
    proofId: proof.id,
    points: confirmed.point.points
  };
}

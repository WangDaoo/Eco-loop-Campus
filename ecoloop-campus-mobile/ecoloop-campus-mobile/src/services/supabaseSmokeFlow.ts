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
  pointId: string;
  points: number;
  verifiedUserPoints: number;
};

export async function runSupabaseWriteSmoke(
  store: Pick<
    SupabaseMobileStore,
    'createSubmission' | 'saveAiPrediction' | 'signOut' | 'signIn' | 'markSubmissionScanned' | 'attachProofImage' | 'confirmSubmission' | 'loadInitialData'
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
  const verified = await store.loadInitialData(volunteer as UserProfile);
  const verifiedSubmission = verified.submissions.find(item => item.id === submission.id);
  if (verifiedSubmission?.status !== 'POINT_CONFIRMED') {
    throw new Error(`Smoke write chưa thấy recycling_submissions POINT_CONFIRMED cho ${submission.id}`);
  }
  const verifiedPoint = verified.pointTransactions.find(item => item.submissionId === submission.id);
  if (!verifiedPoint) {
    throw new Error(`Smoke write chưa thấy point_history cho ${submission.id}`);
  }
  const verifiedProof = verified.proofImages.find(item => item.submissionId === submission.id) ?? verifiedSubmission.proofImage;
  if (!verifiedProof) {
    throw new Error(`Smoke write chưa thấy proof_images cho ${submission.id}`);
  }
  const verifiedUser = verified.users.find(item => item.id === student.id);
  const previousPoints = Number(student.points ?? 0);
  const verifiedUserPoints = Number(verifiedUser?.points ?? NaN);
  if (!verifiedUser || !Number.isFinite(verifiedUserPoints) || verifiedUserPoints < previousPoints + confirmed.point.points) {
    throw new Error(`Smoke write chưa thấy users.points tăng cho ${student.id}`);
  }

  return {
    submissionId: submission.id,
    predictionId: prediction.id,
    qrToken: submission.qrToken,
    proofId: proof.id,
    pointId: verifiedPoint.id,
    points: confirmed.point.points,
    verifiedUserPoints
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { runSupabaseWriteSmoke } from './supabaseSmokeFlow';
import { MobileInitialData } from './supabaseMobileStore';

test('write smoke flow executes student QR to volunteer proof confirmation', async () => {
  const calls: string[] = [];
  const data: MobileInitialData = {
    users: [],
    stations: [{ id: 'station-e1', name: 'Tram E1' } as any],
    wasteTypes: [{ id: 'paper', name: 'Giay sach', unit: 'kg', pointPerUnit: 40, recycleMethod: '', status: 'active' }],
    predictions: [],
    submissions: [],
    missions: [],
    pointTransactions: [],
    feedbacks: [],
    rewards: [],
    rewardRedemptions: [],
  qrScanLogs: [],
  proofImages: []
  };
  const store = {
    async createSubmission() {
      calls.push('createSubmission');
      return { id: 'sub-1', qrToken: 'ECO-1', quantity: 1, binId: 'station-e1' };
    },
    async saveAiPrediction(userId: string, input: { binId?: string }) {
      calls.push(`saveAiPrediction:${userId}:${input.binId}`);
      return { id: 'ai-1', className: 'paper', confidence: 0.9, binGroup: 'Tái chế' };
    },
    async signOut() {
      calls.push('signOut');
    },
    async signIn(role: string) {
      calls.push(`signIn:${role}`);
      return { id: 'vol-1', email: 'volunteer@school.edu.vn' };
    },
    async markSubmissionScanned(qrToken: string) {
      calls.push(`scan:${qrToken}`);
      return { result: 'SUCCESS', submission: { id: 'sub-1', qrToken, status: 'QR_SCANNED' }, note: 'QR hop le' };
    },
    async attachProofImage(submissionId: string) {
      calls.push(`proof:${submissionId}`);
      return { id: 'proof-1', submissionId, imageUrl: 'https://example.com/proof.jpg', status: 'pending' };
    },
    async confirmSubmission(submissionId: string) {
      calls.push(`confirm:${submissionId}`);
      return { submission: { id: submissionId, status: 'POINT_CONFIRMED' }, point: { id: 'point-1', points: 40 } };
    }
  };

  const result = await runSupabaseWriteSmoke(store as any, { id: 'student-1' } as any, data, {
    email: 'volunteer@school.edu.vn',
    password: 'secret'
  });

  assert.deepEqual(calls, ['createSubmission', 'saveAiPrediction:student-1:station-e1', 'signOut', 'signIn:volunteer', 'scan:ECO-1', 'proof:sub-1', 'confirm:sub-1']);
  assert.equal(result.qrToken, 'ECO-1');
  assert.equal(result.predictionId, 'ai-1');
  assert.equal(result.points, 40);
});

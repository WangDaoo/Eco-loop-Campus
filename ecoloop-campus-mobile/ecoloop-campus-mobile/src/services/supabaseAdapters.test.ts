import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyRealtimeChange,
  attachProofImagesToSubmissions,
  buildSubmissionDraft,
  mapBinRow,
  mapMissionRow,
  mapPointHistoryRow,
  mapPredictionRow,
  mapProofImageRow,
  mapQrScanLogRow,
  mapRewardRow,
  mapUserMissionRow,
  mergeMissionProgress,
  mapSubmissionRow,
  mapUserRow,
  toUserRow
} from './supabaseAdapters';

test('maps existing Supabase rows into mobile domain models', () => {
  assert.deepEqual(
    mapUserRow({ id: 'student-1', name: 'Mai', email: 'mai@school.edu.vn', role: 'student', group: 'CNTT', points: '42', status: 'active' }),
    { id: 'student-1', name: 'Mai', email: 'mai@school.edu.vn', role: 'student', group: 'CNTT', points: 42, status: 'active' }
  );

  assert.deepEqual(
    mapBinRow({
      id: 'BIN-01',
      name: 'Tram E1',
      bin_group: 'Tai che',
      location: 'Sanh E1',
      building: 'E1',
      floor: '1',
      qr_code: 'STATION-E1',
      status: 'active',
      capacity: '86',
      map_x: 51.5,
      map_y: 24.25
    }),
    {
      id: 'BIN-01',
      name: 'Tram E1',
      binGroup: 'Tai che',
      location: 'Sanh E1',
      building: 'E1',
      floor: '1',
      qrCode: 'STATION-E1',
      status: 'open',
      capacity: 86,
      mapX: 51.5,
      mapY: 24.25
    }
  );
});

test('preserves account approval statuses for mobile authentication', () => {
  assert.equal(mapUserRow({ id: 'vol-1', role: 'volunteer', status: 'pending' }).status, 'pending');
  assert.equal(mapUserRow({ id: 'vol-2', role: 'volunteer', status: 'rejected' }).status, 'rejected');
  assert.equal(mapUserRow({ id: 'student-locked', role: 'student', status: 'locked' }).status, 'locked');
  assert.equal(mapUserRow({ id: 'student-unknown', role: 'student', status: 'archived' }).status, 'active');
});

test('maps realtime bin rows into one backend coordinate system for mobile map', () => {
  const station = mapBinRow({
    id: 'BIN-RT',
    name: 'Trạm realtime',
    bin_group: 'Tái chế',
    location: 'Sảnh E1',
    building: 'E1',
    floor: '1',
    qr_code: 'QR-RT',
    status: 'active',
    capacity: 130,
    map_x: 120,
    map_y: -10
  });

  assert.equal(station.status, 'open');
  assert.equal(station.capacity, 100);
  assert.equal(station.mapX, 100);
  assert.equal(station.mapY, 0);
});

test('builds a submission draft with one-time QR token and 45 minute expiry', () => {
  const now = new Date('2026-08-02T00:00:00.000Z');
  const draft = buildSubmissionDraft({
    userId: 'student-1',
    input: { binId: 'BIN-01', wasteTypeId: 'paper', quantity: 1.5 },
    wasteType: { id: 'paper', name: 'Giay sach', unit: 'kg', pointPerUnit: 40, recycleMethod: 'Giu kho', status: 'active' },
    now,
    random: () => 0.123456
  });

  assert.equal(draft.id, 'sub-20260802000000-123456');
  assert.equal(draft.qrToken, 'ECO-20260802000000-123456');
  assert.equal(draft.status, 'CREATED');
  assert.equal(draft.unit, 'kg');
  assert.equal(draft.expiredAt.toISOString(), '2026-08-02T00:45:00.000Z');
});

test('maps submission and point history rows then applies realtime changes by id', () => {
  const submission = mapSubmissionRow({
    id: 'sub-1',
    user_id: 'student-1',
    bin_id: 'BIN-01',
    waste_type_id: 'paper',
    quantity: '2',
    unit: 'kg',
    qr_token: 'ECO-1',
    status: 'POINT_CONFIRMED',
    created_at: '2026-08-02T01:00:00.000Z',
    expired_at: '2026-08-02T01:45:00.000Z',
    verified_by: 'volunteer-1',
    verified_at: '2026-08-02T01:20:00.000Z',
    actual_quantity: '1.8',
    volunteer_note: 'Hop le'
  });

  assert.equal(submission.createdAt.toISOString(), '2026-08-02T01:00:00.000Z');
  assert.equal(submission.actualQuantity, 1.8);

  const point = mapPointHistoryRow({
    id: 9,
    user_id: 'student-1',
    prediction_id: 'sub-1',
    points: '72',
    action: 'Xac nhan 1.8 kg giay sach',
    created_at: '2026-08-02T01:21:00.000Z',
    source: 'volunteer_verification'
  });

  assert.deepEqual(point, {
    id: '9',
    userId: 'student-1',
    submissionId: 'sub-1',
    points: 72,
    type: 'earn',
    status: 'confirmed',
    description: 'Xac nhan 1.8 kg giay sach',
    createdAt: new Date('2026-08-02T01:21:00.000Z')
  });

  assert.deepEqual(applyRealtimeChange([{ id: 'a', value: 1 }], { eventType: 'INSERT', new: { id: 'b', value: 2 } }), [
    { id: 'b', value: 2 },
    { id: 'a', value: 1 }
  ]);
  assert.deepEqual(applyRealtimeChange([{ id: 'a', value: 1 }], { eventType: 'UPDATE', new: { id: 'a', value: 3 } }), [
    { id: 'a', value: 3 }
  ]);
  assert.deepEqual(applyRealtimeChange([{ id: 'a', value: 1 }], { eventType: 'DELETE', old: { id: 'a' } }), []);
});

test('maps AI prediction rows from Supabase for mobile and admin review', () => {
  assert.deepEqual(
    mapPredictionRow({
      id: 'ai-1',
      class: 'plastic',
      confidence: '0.88',
      source: 'camera',
      timestamp: '2026-08-02T07:00:00.000Z',
      bin_group: 'Tái chế',
      status: 'pending',
      user_id: 'student-1',
      bin_id: 'bin-1',
      image_name: 'bottle.jpg'
    }),
    {
      id: 'ai-1',
      className: 'plastic',
      confidence: 0.88,
      source: 'camera',
      timestamp: new Date('2026-08-02T07:00:00.000Z'),
      binGroup: 'Tái chế',
      status: 'pending',
      userId: 'student-1',
      binId: 'bin-1',
      imageName: 'bottle.jpg',
      imageUrl: undefined,
      thumbnailUrl: undefined
    }
  );
});

test('maps proof images and attaches them to submissions by submission id', () => {
  const submission = mapSubmissionRow({
    id: 'sub-1',
    user_id: 'student-1',
    bin_id: 'BIN-01',
    waste_type_id: 'paper',
    quantity: 1,
    unit: 'kg',
    qr_token: 'ECO-1',
    status: 'PENDING_REVIEW',
    created_at: '2026-08-02T01:00:00.000Z',
    expired_at: '2026-08-02T01:45:00.000Z'
  });
  const proof = mapProofImageRow({
    id: 'proof-1',
    submission_id: 'sub-1',
    image_url: 'https://cdn.example/proof-1.jpg',
    image_hash: 'hash-1',
    verification_code: 'RVW-1234',
    status: 'pending'
  });

  assert.equal(proof.submissionId, 'sub-1');
  assert.equal(proof.verificationCode, 'RVW-1234');
  assert.equal(attachProofImagesToSubmissions([submission], [proof])[0].proofImage?.imageUrl, 'https://cdn.example/proof-1.jpg');
});

test('maps reward catalog rows from Supabase into mobile rewards', () => {
  assert.deepEqual(
    mapRewardRow({
      id: 'coffee',
      title: 'Ca phe canteen',
      description: 'Giam 50% tai canteen',
      cost_points: '300',
      status: 'active',
      color: '#F6B83F'
    }),
    {
      id: 'coffee',
      title: 'Ca phe canteen',
      description: 'Giam 50% tai canteen',
      costPoints: 300,
      status: 'active',
      color: '#F6B83F'
    }
  );

  assert.equal(mapRewardRow({ id: 'old', cost_points: 100, status: 'disabled' }).status, 'inactive');
});
test('maps mission catalog and merges student mission progress', () => {
  const mission = mapMissionRow({
    id: 'submit-3',
    title: 'Gui rac tai che 3 lan',
    description: 'Tao 3 giao dich trong tuan',
    target: '3',
    reward_points: '100',
    action_label: 'Tiep tuc',
    status: 'active'
  });
  const progress = mapUserMissionRow({
    id: 'student-1-submit-3',
    user_id: 'student-1',
    mission_id: 'submit-3',
    current: '2',
    completed: false,
    status: 'active'
  });

  assert.equal(mission.current, 0);
  assert.equal(mission.target, 3);
  assert.equal(progress.userId, 'student-1');
  assert.deepEqual(mergeMissionProgress([mission], [progress], 'student-1'), [
    {
      ...mission,
      current: 2,
      completed: false,
      status: 'active'
    }
  ]);

  const completed = mapUserMissionRow({ id: 'p2', user_id: 'student-1', mission_id: 'submit-3', current: 3, completed: true, status: 'completed' });
  assert.equal(mergeMissionProgress([mission], [completed], 'student-1')[0].actionLabel, 'Xong');
});
test('maps QR scan logs for volunteer anti-fraud history', () => {
  assert.deepEqual(
    mapQrScanLogRow({
      id: 'scan-1',
      qr_token: 'ECO-1',
      scanned_by: 'vol-1',
      station_id: 'bin-1',
      result: 'WRONG_STATION',
      note: 'Wrong station',
      scanned_at: '2026-08-02T06:00:00.000Z'
    }),
    {
      id: 'scan-1',
      qrToken: 'ECO-1',
      scannedBy: 'vol-1',
      stationId: 'bin-1',
      result: 'WRONG_STATION',
      note: 'Wrong station',
      scannedAt: new Date('2026-08-02T06:00:00.000Z')
    }
  );
});
test('maps avatar keys between Supabase and mobile profile', () => {
  const profile = mapUserRow({ id: 'student-1', name: 'Mai', email: 'mai@school.edu.vn', role: 'student', group: 'CNTT', points: 42, status: 'active', avatar_key: 'sunny' });
  assert.equal(profile.avatarKey, 'sunny');
  assert.equal(toUserRow(profile).avatar_key, 'sunny');
});

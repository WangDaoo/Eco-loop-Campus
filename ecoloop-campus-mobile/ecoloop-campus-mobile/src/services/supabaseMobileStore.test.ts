import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMobileStore } from './supabaseMobileStore';
import { Reward } from '../types';

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeFakeSupabase(seed: Tables, authUser = { id: 'student-1', email: 'student@school.edu.vn' }, errorTables: Record<string, string> = {}) {
  const tables: Tables = clone(seed);
  const calls: Row[] = [];

  class Query {
    private filters: { column: string; value: any }[] = [];
    private orderColumn = '';
    private ascending = false;
    private action: 'select' | 'insert' | 'update' = 'select';
    private payload: Row | Row[] | null = null;

    constructor(private table: string) {}

    select() {
      return this;
    }

    eq(column: string, value: any) {
      this.filters.push({ column, value });
      return this;
    }

    order(column: string, options?: { ascending?: boolean }) {
      this.orderColumn = column;
      this.ascending = Boolean(options?.ascending);
      return this;
    }

    insert(payload: Row | Row[]) {
      this.action = 'insert';
      this.payload = payload;
      return this;
    }

    update(payload: Row) {
      this.action = 'update';
      this.payload = payload;
      return this;
    }

    async maybeSingle() {
      const error = this.error();
      return { data: error ? null : this.execute()[0] ?? null, error };
    }

    async single() {
      const error = this.error();
      return { data: error ? null : this.execute()[0] ?? null, error };
    }

    then(resolve: (value: { data: Row[]; error: { message: string } | null }) => void) {
      const error = this.error();
      return Promise.resolve({ data: error ? [] : this.execute(), error }).then(resolve);
    }

    private error() {
      return errorTables[this.table] ? { message: errorTables[this.table] } : null;
    }

    private execute() {
      const tableRows = (tables[this.table] ??= []);

      if (this.action === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
        const inserted = rows.map(row => clone(row));
        tableRows.unshift(...inserted);
        calls.push({ action: 'insert', table: this.table, rows: inserted });
        return inserted;
      }

      if (this.action === 'update') {
        const updated: Row[] = [];
        tableRows.forEach((row, index) => {
          if (this.matches(row)) {
            tableRows[index] = { ...row, ...(this.payload as Row) };
            updated.push(clone(tableRows[index]));
          }
        });
        calls.push({ action: 'update', table: this.table, rows: updated });
        return updated;
      }

      const selected = tableRows.filter(row => this.matches(row)).map(row => clone(row));
      if (this.orderColumn) {
        selected.sort((left, right) => {
          const result = String(left[this.orderColumn] ?? '').localeCompare(String(right[this.orderColumn] ?? ''));
          return this.ascending ? result : -result;
        });
      }
      return selected;
    }

    private matches(row: Row) {
      return this.filters.every(filter => row[filter.column] === filter.value);
    }
  }

  return {
    tables,
    calls,
    auth: {
      async signInWithPassword(input: { email: string; password: string }) {
        calls.push({ action: 'signIn', email: input.email, password: input.password });
        return { data: { user: authUser }, error: null };
      },
      async signUp(input: { email: string; password: string; options?: { data?: Row } }) {
        calls.push({ action: 'signUp', email: input.email, password: input.password });
        return { data: { user: authUser }, error: null };
      },
      async signOut() {
        calls.push({ action: 'signOut' });
        return { error: null };
      },
      async getSession() {
        return { data: { session: { user: authUser } }, error: null };
      }
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, body: unknown, options?: Row) {
            calls.push({ action: 'storageUpload', bucket, path, body, options });
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            calls.push({ action: 'storagePublicUrl', bucket, path });
            return { data: { publicUrl: `https://cdn.example/${bucket}/${path}` } };
          }
        };
      }
    },
    from(table: string) {
      return new Query(table);
    }
  };
}

function makeNoReturningUpdateSupabase(seed: Tables, noReturnTables: string[]) {
  const fake = makeFakeSupabase(seed);
  const baseFrom = fake.from.bind(fake);
  fake.from = (table: string) => {
    const query: any = baseFrom(table);
    if (!noReturnTables.includes(table)) return query;
    const originalUpdate = query.update.bind(query);
    query.update = (payload: Row) => {
      const updatedQuery: any = originalUpdate(payload);
      const originalSingle = updatedQuery.single.bind(updatedQuery);
      updatedQuery.single = async () => {
        await originalSingle();
        return { data: null, error: null };
      };
      updatedQuery.maybeSingle = async () => {
        await originalSingle();
        return { data: null, error: null };
      };
      return updatedQuery;
    };
    return query;
  };
  return fake;
}

const baseTables: Tables = {
  users: [
    { id: 'student-1', name: 'Mai', email: 'student@school.edu.vn', role: 'student', group: 'CNTT', points: 20, status: 'active' },
    { id: 'vol-1', name: 'Long', email: 'volunteer@school.edu.vn', role: 'volunteer', group: 'CLB Moi truong', points: 0, status: 'active' }
  ],
  bins: [
    { id: 'bin-1', name: 'Tram E1', bin_group: 'Tai che', location: 'Sanh E1', building: 'E1', floor: '1', qr_code: 'STATION-E1', status: 'active', capacity: 30 }
  ],
  waste_types: [
    { id: 'paper', name: 'Giay sach', unit: 'kg', point_per_unit: 40, recycle_method: 'Giu kho', status: 'active' }
  ],
  missions: [
    { id: 'submit-3', title: 'Gui rac tai che 3 lan', description: 'Tao 3 giao dich trong tuan', target: 3, reward_points: 100, action_label: 'Tiep tuc', status: 'active' }
  ],
  user_missions: [
    { id: 'student-1-submit-3', user_id: 'student-1', mission_id: 'submit-3', current: 1, completed: false, status: 'active' }
  ],
  recycling_submissions: [],
  predictions: [],
  point_history: [],
  feedback: [],
  rewards: [
    { id: 'coffee', title: 'Ca phe canteen', description: 'Giam 50%', cost_points: 30, status: 'active', color: '#F6B83F' }
  ],
  reward_redemptions: [],
  qr_scan_logs: [
    { id: 'scan-1', qr_token: 'ECO-1', scanned_by: 'vol-1', station_id: 'bin-1', result: 'INVALID_TOKEN', note: 'Sai QR', scanned_at: '2026-08-02T06:00:00.000Z' }
  ],
  proof_images: []
};

test('Supabase mobile store signs in, loads data, creates QR submission, and confirms points', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);
  const now = new Date();

  const profile = await store.signIn('student', 'student@school.edu.vn', 'secret');
  assert.equal(profile.id, 'student-1');

  const data = await store.loadInitialData(profile);
  assert.equal(data.stations[0].id, 'bin-1');
  assert.equal(data.wasteTypes[0].pointPerUnit, 40);
  assert.equal(data.rewards[0].id, 'coffee');
  assert.equal(data.rewards[0].costPoints, 30);
  assert.equal(data.missions[0].id, 'submit-3');
  assert.equal(data.missions[0].current, 1);

  const submission = await store.createSubmission(
    profile.id,
    { binId: 'bin-1', wasteTypeId: 'paper', quantity: 2 },
    data.wasteTypes,
    now,
    () => 0.654321
  );
  assert.equal(submission.qrToken, `ECO-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-654321`);
  assert.equal(fake.tables.recycling_submissions[0].status, 'CREATED');

  const scanned = await store.markSubmissionScanned(submission.qrToken, 'vol-1', 'bin-1');
  assert.equal(scanned.result, 'SUCCESS');
  assert.equal(scanned.submission?.status, 'QR_SCANNED');
  assert.equal(fake.tables.qr_scan_logs[0].result, 'SUCCESS');

  const confirmed = await store.confirmSubmission(submission.id, 1.5, 'vol-1', 'Hop le', data.wasteTypes);
  assert.equal(confirmed.submission.status, 'POINT_CONFIRMED');
  assert.equal(confirmed.point.points, 60);
  assert.equal(fake.tables.users.find(row => row.id === 'student-1')?.points, 80);
});

test('Supabase mobile store blocks point confirmation until QR scan succeeds', async () => {
  const fake = makeFakeSupabase({
    ...baseTables,
    recycling_submissions: [
      {
        id: 'sub-created',
        user_id: 'student-1',
        bin_id: 'bin-1',
        waste_type_id: 'paper',
        quantity: 1,
        unit: 'kg',
        qr_token: 'ECO-CREATED',
        status: 'CREATED',
        created_at: '2026-08-02T03:00:00.000Z',
        expired_at: '2026-08-02T03:45:00.000Z'
      }
    ]
  });
  const store = createSupabaseMobileStore(fake as any);

  await assert.rejects(
    () => store.confirmSubmission('sub-created', 1, 'vol-1', 'Hop le', baseTables.waste_types.map(row => ({
      id: String(row.id),
      name: String(row.name),
      unit: 'kg' as const,
      pointPerUnit: Number(row.point_per_unit),
      recycleMethod: String(row.recycle_method),
      status: 'active' as const
    }))),
    /QR chua duoc quet hop le/
  );
  assert.equal(fake.tables.point_history.length, 0);
  assert.equal(fake.tables.recycling_submissions[0].status, 'CREATED');
});

test('Supabase mobile store confirms points even when users update does not return a row', async () => {
  const fake = makeNoReturningUpdateSupabase({
    ...baseTables,
    recycling_submissions: [
      {
        id: 'sub-scanned',
        user_id: 'student-1',
        bin_id: 'bin-1',
        waste_type_id: 'paper',
        quantity: 1,
        unit: 'kg',
        qr_token: 'ECO-SCANNED',
        status: 'QR_SCANNED',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        expired_at: new Date(Date.now() + 45 * 60 * 1000).toISOString()
      }
    ]
  }, ['users']);
  const store = createSupabaseMobileStore(fake as any);

  const confirmed = await store.confirmSubmission('sub-scanned', 1, 'vol-1', 'Hop le', baseTables.waste_types.map(row => ({
    id: String(row.id),
    name: String(row.name),
    unit: 'kg' as const,
    pointPerUnit: Number(row.point_per_unit),
    recycleMethod: String(row.recycle_method),
    status: 'active' as const
  })));

  assert.equal(confirmed.submission.status, 'POINT_CONFIRMED');
  assert.equal(confirmed.point.points, 40);
  assert.equal(fake.tables.users.find(row => row.id === 'student-1')?.points, 60);
});

test('Supabase mobile store marks expired QR submissions as EXPIRED during scan', async () => {
  const fake = makeFakeSupabase({
    ...baseTables,
    recycling_submissions: [
      {
        id: 'sub-expired',
        user_id: 'student-1',
        bin_id: 'bin-1',
        waste_type_id: 'paper',
        quantity: 1,
        unit: 'kg',
        qr_token: 'ECO-EXPIRED',
        status: 'CREATED',
        created_at: '2000-01-01T00:00:00.000Z',
        expired_at: '2000-01-01T00:45:00.000Z'
      }
    ]
  });
  const store = createSupabaseMobileStore(fake as any);

  const scanned = await store.markSubmissionScanned('ECO-EXPIRED', 'vol-1', 'bin-1');

  assert.equal(scanned.result, 'EXPIRED');
  assert.equal(scanned.submission?.status, 'EXPIRED');
  assert.equal(fake.tables.recycling_submissions[0].status, 'EXPIRED');
  assert.equal(fake.tables.qr_scan_logs[0].result, 'EXPIRED');
});

test('Supabase mobile store returns scan outcomes for wrong station, used QR, and invalid token', async () => {
  const fake = makeFakeSupabase({
    ...baseTables,
    recycling_submissions: [
      {
        id: 'sub-created',
        user_id: 'student-1',
        bin_id: 'bin-1',
        waste_type_id: 'paper',
        quantity: 1,
        unit: 'kg',
        qr_token: 'ECO-CREATED',
        status: 'CREATED',
        created_at: '2026-08-02T03:00:00.000Z',
        expired_at: '2099-08-02T03:45:00.000Z'
      },
      {
        id: 'sub-confirmed',
        user_id: 'student-1',
        bin_id: 'bin-1',
        waste_type_id: 'paper',
        quantity: 1,
        unit: 'kg',
        qr_token: 'ECO-USED',
        status: 'POINT_CONFIRMED',
        created_at: '2026-08-02T03:00:00.000Z',
        expired_at: '2099-08-02T03:45:00.000Z'
      }
    ]
  });
  const store = createSupabaseMobileStore(fake as any);

  const wrongStation = await store.markSubmissionScanned('ECO-CREATED', 'vol-1', 'station-other');
  const used = await store.markSubmissionScanned('ECO-USED', 'vol-1', 'bin-1');
  const invalid = await store.markSubmissionScanned('ECO-MISSING', 'vol-1', 'bin-1');

  assert.equal(wrongStation.result, 'WRONG_STATION');
  assert.equal(wrongStation.submission?.status, 'CREATED');
  assert.equal(used.result, 'ALREADY_USED');
  assert.equal(used.submission?.status, 'POINT_CONFIRMED');
  assert.equal(invalid.result, 'INVALID_TOKEN');
  assert.equal(invalid.submission, undefined);
  assert.deepEqual(fake.tables.qr_scan_logs.slice(0, 3).map(row => row.result), ['INVALID_TOKEN', 'ALREADY_USED', 'WRONG_STATION']);
});

test('Supabase mobile store submits feedback and requests reward redemption', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);
  const reward: Reward = {
    id: 'coffee',
    title: 'Ca phe canteen',
    description: 'Giam 50%',
    costPoints: 30,
    status: 'active',
    color: '#f59e0b'
  };

  const feedback = await store.submitFeedback(
    { id: 'student-1', name: 'Mai', email: 'student@school.edu.vn', role: 'student', group: 'CNTT', points: 20, status: 'active' },
    { stationId: 'bin-1', type: 'bin_full', message: 'Thung sap day' }
  );
  assert.equal(feedback.status, 'new');
  assert.equal(fake.tables.feedback[0].user_id, 'student-1');
  assert.equal(fake.tables.feedback[0].category, 'bin_full');

  const redemption = await store.requestReward('student-1', reward);
  assert.equal(redemption.status, 'requested');
  assert.equal(fake.tables.reward_redemptions[0].reward_label, 'Ca phe canteen');
});

test('Supabase mobile store saves AI predictions for admin review', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);

  const prediction = await store.saveAiPrediction('student-1', {
    className: 'plastic',
    confidence: 0.88,
    source: 'camera',
    binId: 'bin-1',
    imageName: 'bottle.jpg'
  }, new Date('2026-08-02T07:00:00.000Z'), () => 0.111222);

  assert.equal(prediction.id, 'ai-20260802070000-111222');
  assert.equal(prediction.binGroup, 'Tái chế');
  assert.equal(fake.tables.predictions[0].user_id, 'student-1');
  assert.equal(fake.tables.predictions[0].class, 'plastic');
  assert.equal(fake.tables.predictions[0].status, 'pending');
  assert.equal(fake.tables.predictions[0].image_name, 'bottle.jpg');
});

test('Supabase mobile store uploads AI prediction images before saving review rows', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ blob: async () => 'image-blob' })) as any;

  try {
    const prediction = await store.saveAiPrediction('student-1', {
      className: 'paper',
      confidence: 0.91,
      source: 'camera',
      binId: 'bin-1',
      imageUri: 'file:///tmp/paper.jpg',
      imageName: 'paper.jpg',
      mimeType: 'image/jpeg'
    } as any, new Date('2026-08-02T08:00:00.000Z'), () => 0.222333);

    assert.equal(prediction.imageUrl, 'https://cdn.example/prediction-images/mobile-ai/student-1/ai-20260802080000-222333.jpg');
    assert.equal(fake.tables.predictions[0].image_url, prediction.imageUrl);
    assert.equal(fake.calls.find(call => call.action === 'storageUpload')?.bucket, 'prediction-images');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Supabase mobile store loads volunteer QR scan logs for realtime anti-fraud review', async () => {
  const fake = makeFakeSupabase(baseTables, { id: 'vol-1', email: 'volunteer@school.edu.vn' });
  const store = createSupabaseMobileStore(fake as any);
  const profile = await store.signIn('volunteer', 'volunteer@school.edu.vn', 'secret');

  const data = await store.loadInitialData(profile);

  assert.equal(data.qrScanLogs[0].id, 'scan-1');
  assert.equal(data.qrScanLogs[0].result, 'INVALID_TOKEN');
  assert.equal(data.qrScanLogs[0].scannedBy, 'vol-1');
});
test('Supabase mobile store saves proof image rows for volunteer verification', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);

  const proof = await store.attachProofImage('sub-1', {
    imageUrl: 'https://cdn.example/proof.jpg',
    imageHash: 'hash-proof',
    note: 'Anh chup truc tiep tai tram'
  }, new Date('2026-08-02T04:00:00.000Z'), () => 0.1234);

  assert.equal(proof.id, 'proof-20260802040000-123400');
  assert.equal(proof.submissionId, 'sub-1');
  assert.equal(proof.verificationCode, 'RVW-123400');
  assert.equal(fake.tables.proof_images[0].image_url, 'https://cdn.example/proof.jpg');
  assert.equal(fake.tables.proof_images[0].status, 'pending');
});

test('Supabase mobile store reports missing mobile schema with actionable setup hint', async () => {
  const fake = makeFakeSupabase(baseTables, { id: 'student-1', email: 'student@school.edu.vn' }, {
    waste_types: 'relation "public.waste_types" does not exist',
    recycling_submissions: 'permission denied for table recycling_submissions'
  });
  const store = createSupabaseMobileStore(fake as any);

  const health = await store.checkSchema();

  assert.equal(health.ok, false);
  assert.deepEqual(health.missingTables, ['waste_types', 'recycling_submissions']);
  assert.match(health.message, /schema.sql/);
});

test('Supabase mobile store marks operating data incomplete when stations or waste types are empty', () => {
  const store = createSupabaseMobileStore(makeFakeSupabase(baseTables) as any);

  assert.deepEqual(store.getOperatingReadiness({ stations: [], wasteTypes: baseTables.waste_types.map(row => ({ id: row.id, name: row.name, unit: row.unit, pointPerUnit: row.point_per_unit, recycleMethod: row.recycle_method, status: row.status })) as any }), {
    ok: false,
    missing: ['bins']
  });
  assert.deepEqual(store.getOperatingReadiness({ stations: [{ id: 'bin-1' }] as any, wasteTypes: [] }), {
    ok: false,
    missing: ['waste_types']
  });
});

test('Supabase mobile store advances user mission progress in user_missions', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);
  const profile = await store.signIn('student', 'student@school.edu.vn', 'secret');
  const data = await store.loadInitialData(profile);

  const mission = await store.advanceMission(profile.id, 'submit-3', data.missions);

  assert.equal(mission.current, 2);
  assert.equal(mission.completed, false);
  assert.equal(fake.tables.user_missions[0].current, 2);

  await store.advanceMission(profile.id, 'submit-3', [mission]);
  assert.equal(fake.tables.user_missions[0].current, 3);
  assert.equal(fake.tables.user_missions[0].completed, true);
  assert.equal(fake.tables.user_missions[0].status, 'completed');
  assert.equal(fake.tables.point_history[0].points, 100);
  assert.equal(fake.tables.point_history[0].source, 'mission_reward');
  assert.equal(fake.tables.users.find(row => row.id === 'student-1')?.points, 120);
});

test('Supabase mobile store does not pay mission reward twice after completion', async () => {
  const fake = makeFakeSupabase({
    ...baseTables,
    user_missions: [
      { id: 'student-1-submit-3', user_id: 'student-1', mission_id: 'submit-3', current: 3, completed: true, status: 'completed' }
    ]
  });
  const store = createSupabaseMobileStore(fake as any);
  const profile = await store.signIn('student', 'student@school.edu.vn', 'secret');
  const data = await store.loadInitialData(profile);

  const mission = await store.advanceMission(profile.id, 'submit-3', data.missions);

  assert.equal(mission.completed, true);
  assert.equal(fake.tables.point_history.length, 0);
  assert.equal(fake.tables.users.find(row => row.id === 'student-1')?.points, 20);
});

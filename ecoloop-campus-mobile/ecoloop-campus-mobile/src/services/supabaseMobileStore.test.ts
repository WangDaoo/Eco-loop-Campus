import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMobileStore } from './supabaseMobileStore';
import { Reward } from '../types';

type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeFakeSupabase(
  seed: Tables,
  authUser = { id: 'student-1', email: 'student@school.edu.vn' },
  errorTables: Record<string, string> = {},
  rpcHandlers: Record<string, (params: Row) => Row | Promise<Row>> = {},
  hasSignupSession = true
) {
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

  const fake: any = {
    tables,
    calls,
    auth: {
      async signInWithPassword(input: { email: string; password: string }) {
        calls.push({ action: 'signIn', email: input.email, password: input.password });
        return { data: { user: authUser }, error: null };
      },
      async signUp(input: { email: string; password: string; options?: { data?: Row } }) {
        calls.push({ action: 'signUp', email: input.email, password: input.password });
        return { data: { user: authUser, session: hasSignupSession ? { user: authUser } : null }, error: null };
      },
      async updateUser(input: { password?: string }) {
        calls.push({ action: 'updateUser', password: input.password });
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
  if (Object.keys(rpcHandlers).length > 0) {
    fake.rpc = async (name: string, params: Row) => {
      calls.push({ action: 'rpc', name, params });
      const handler = rpcHandlers[name];
      if (!handler) return { data: null, error: { message: `function ${name} does not exist` } };
      return { data: await handler(params), error: null };
    };
  }
  return fake;
}

function makeMissingRpcSupabase(seed: Tables) {
  const fake: any = makeFakeSupabase(seed);
  fake.rpc = async (name: string, params: Row) => {
    fake.calls.push({ action: 'rpc', name, params });
    return { data: null, error: { message: `Could not find the function public.${name} in the schema cache` } };
  };
  return fake;
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
    { id: 'bin-1', name: 'Tram E1', bin_group: 'Tai che', location: 'Sanh E1', building: 'E1', floor: '1', qr_code: 'ECL-ST-STATION-E1', status: 'active', capacity: 30 }
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

baseTables.avatar_presets = [
  { key: 'sprout', label: 'Mầm xanh', image_url: 'https://cdn.example/avatar/sprout.png', background: '#cbf9e4', tile: '#a8f2ab', accent: '#8bc34a', face: '#2c6e6e', status: 'active', sort_order: 1 },
  { key: 'hidden', label: 'Đã ẩn', image_url: 'https://cdn.example/avatar/hidden.png', background: '#f8fafc', tile: '#e2e8f0', accent: '#94a3b8', face: '#334155', status: 'inactive', sort_order: 99 }
];

test('Supabase mobile store creates registration profile without optional avatar columns', async () => {
  const authUser = { id: 'new-student', email: 'new.student@school.edu.vn' };
  const fake = makeFakeSupabase({ ...baseTables, users: [] }, authUser);
  const store = createSupabaseMobileStore(fake as any);

  const profile = await store.signUp('Nguyen Van Moi', authUser.email, 'secret-123', 'student');

  assert.equal(profile.id, authUser.id);
  assert.equal(fake.tables.users[0].name, 'Nguyen Van Moi');
  assert.equal(fake.tables.users[0].role, 'student');
  assert.equal(Object.hasOwn(fake.tables.users[0], 'avatar_key'), false);
  assert.equal(Object.hasOwn(fake.tables.users[0], 'avatar_url'), false);
});

test('Supabase mobile store does not insert a profile when signup requires email confirmation', async () => {
  const authUser = { id: 'new-student-confirm', email: 'new.student.confirm@school.edu.vn' };
  const fake = makeFakeSupabase({ ...baseTables, users: [] }, authUser, {}, {}, false);
  const store = createSupabaseMobileStore(fake as any);

  const profile = await store.signUp('Nguyen Van Moi', authUser.email, 'secret-123', 'student');

  assert.equal(profile.id, authUser.id);
  assert.equal((profile as any).requiresEmailConfirmation, true);
  assert.equal(fake.tables.users.length, 0);
  assert.equal(fake.calls.some((call: Row) => call.action === 'insert' && call.table === 'users'), false);
});

test('Supabase mobile store verifies the current password before updating Auth password', async () => {
  const fake = makeFakeSupabase(baseTables);
  const store = createSupabaseMobileStore(fake as any);

  await store.updatePassword('student@school.edu.vn', 'old-secret-123', 'new-secret-123');

  assert.deepEqual(fake.calls.find((call: Row) => call.action === 'signIn'), {
    action: 'signIn',
    email: 'student@school.edu.vn',
    password: 'old-secret-123'
  });
  assert.deepEqual(fake.calls.find((call: Row) => call.action === 'updateUser'), {
    action: 'updateUser',
    password: 'new-secret-123'
  });
});

test('Supabase mobile store creates volunteer registrations as pending for admin approval', async () => {
  const authUser = { id: 'new-volunteer', email: 'new.volunteer@school.edu.vn' };
  const fake = makeFakeSupabase({ ...baseTables, users: [] }, authUser);
  const store = createSupabaseMobileStore(fake as any);

  const profile = await store.signUp('Tinh Nguyen Vien Moi', authUser.email, 'secret-123', 'volunteer');

  assert.equal(profile.status, 'pending');
  assert.equal(fake.tables.users[0].role, 'volunteer');
  assert.equal(fake.tables.users[0].status, 'pending');
});

test('Supabase mobile store blocks pending volunteer sign-in until admin approval', async () => {
  const fake = makeFakeSupabase({
    ...baseTables,
    users: [
      { id: 'vol-1', name: 'Long', email: 'volunteer@school.edu.vn', role: 'volunteer', group: 'CLB Moi truong', points: 0, status: 'pending' }
    ]
  }, { id: 'vol-1', email: 'volunteer@school.edu.vn' });
  const store = createSupabaseMobileStore(fake as any);

  await assert.rejects(
    () => store.signIn('volunteer', 'volunteer@school.edu.vn', 'secret'),
    /đang chờ admin phê duyệt/
  );
});

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
  assert.equal(data.avatarOptions[0].key, 'sprout');
  assert.equal(data.avatarOptions.some(option => option.key === 'hidden'), false);
  assert.equal(data.missions[0].id, 'submit-3');
  assert.equal(data.missions[0].current, 1);

  const submission = await store.createSubmission(
    profile.id,
    { binId: 'bin-1', wasteTypeId: 'paper', quantity: 2 },
    data.wasteTypes,
    now,
    () => 0.654321
  );
  assert.equal(submission.qrToken, `ECL-SUB-${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-654321`);
  assert.equal(fake.tables.recycling_submissions[0].status, 'CREATED');

  const scanned = await store.markSubmissionScanned(submission.qrToken, 'vol-1', 'bin-1');
  assert.equal(scanned.result, 'SUCCESS');
  assert.equal(scanned.submission?.status, 'QR_SCANNED');
  assert.equal(fake.tables.qr_scan_logs[0].result, 'SUCCESS');

  const confirmed = await store.confirmSubmission(submission.id, 1.5, 'vol-1', 'Hop le', data.wasteTypes);
  assert.equal(confirmed.submission.status, 'POINT_CONFIRMED');
  assert.equal(confirmed.point.points, 60);
  assert.equal(fake.tables.users.find((row: Row) => row.id === 'student-1')?.points, 80);
});

test('Supabase mobile store uses RPC for recycling submission lifecycle when RPC is available', async () => {
  const createdRow = {
    id: 'sub-rpc',
    user_id: 'student-1',
    bin_id: 'bin-1',
    waste_type_id: 'paper',
    quantity: 2,
    unit: 'kg',
    qr_token: 'ECO-RPC',
    status: 'CREATED',
    created_at: '2026-08-22T08:00:00.000Z',
    expired_at: '2026-08-22T08:45:00.000Z'
  };
  const scannedRow = { ...createdRow, status: 'QR_SCANNED', verified_by: 'vol-1', verified_at: '2026-08-22T08:05:00.000Z' };
  const confirmedRow = { ...scannedRow, status: 'POINT_CONFIRMED', actual_quantity: 1.5, volunteer_note: 'Hop le' };
  const pointRow = {
    id: 'point-rpc',
    user_id: 'student-1',
    submission_id: 'sub-rpc',
    points: 60,
    status: 'confirmed',
    source: 'volunteer_verification',
    description: 'Xac nhan 1.5 kg Giay sach',
    created_at: '2026-08-22T08:06:00.000Z'
  };
  const fake = makeFakeSupabase(baseTables, { id: 'student-1', email: 'student@school.edu.vn' }, {}, {
    create_recycling_submission: params => {
      assert.deepEqual(params, { p_bin_id: 'bin-1', p_waste_type_id: 'paper', p_quantity: 2 });
      return createdRow;
    },
    scan_recycling_qr: params => {
      assert.deepEqual(params, { p_qr_token: 'ECO-RPC', p_station_id: 'bin-1' });
      return { result: 'SUCCESS', submission: scannedRow, note: 'QR hop le' };
    },
    confirm_recycling_submission: params => {
      assert.deepEqual(params, { p_submission_id: 'sub-rpc', p_actual_quantity: 1.5, p_volunteer_note: 'Hop le' });
      return { submission: confirmedRow, point: pointRow, updated_user_points: 80 };
    },
    reject_recycling_submission: params => {
      assert.deepEqual(params, { p_submission_id: 'sub-rpc', p_volunteer_note: 'Sai loai rac' });
      return { ...createdRow, status: 'REJECTED', volunteer_note: 'Sai loai rac' };
    },
    request_recycling_review: params => {
      assert.deepEqual(params, { p_submission_id: 'sub-rpc', p_volunteer_note: 'Can admin review' });
      return { ...createdRow, status: 'PENDING_REVIEW', volunteer_note: 'Can admin review' };
    }
  });
  const store = createSupabaseMobileStore(fake as any);
  const wasteTypes = baseTables.waste_types.map(row => ({
    id: String(row.id),
    name: String(row.name),
    unit: 'kg' as const,
    pointPerUnit: Number(row.point_per_unit),
    recycleMethod: String(row.recycle_method),
    status: 'active' as const
  }));

  const created = await store.createSubmission('student-1', { binId: 'bin-1', wasteTypeId: 'paper', quantity: 2 }, wasteTypes);
  const scanned = await store.markSubmissionScanned(created.qrToken, 'vol-1', 'bin-1');
  const confirmed = await store.confirmSubmission(created.id, 1.5, 'vol-1', 'Hop le', wasteTypes);
  const rejected = await store.rejectSubmission(created.id, 'vol-1', 'Sai loai rac');
  const review = await store.requestReview(created.id, 'vol-1', 'Can admin review');

  assert.equal(created.id, 'sub-rpc');
  assert.equal(scanned.result, 'SUCCESS');
  assert.equal(confirmed.submission.status, 'POINT_CONFIRMED');
  assert.equal(confirmed.point.points, 60);
  assert.equal(rejected.status, 'REJECTED');
  assert.equal(review.status, 'PENDING_REVIEW');
  assert.deepEqual(fake.calls.filter((call: Row) => call.action === 'rpc').map((call: Row) => call.name), [
    'create_recycling_submission',
    'scan_recycling_qr',
    'confirm_recycling_submission',
    'reject_recycling_submission',
    'request_recycling_review'
  ]);
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

test('Supabase mobile store refuses atomic confirmation when live RPC is missing', async () => {
  const fake = makeMissingRpcSupabase({
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
  });
  const store = createSupabaseMobileStore(fake as any);

  await assert.rejects(
    () => store.confirmSubmission('sub-scanned', 1, 'vol-1', 'Hop le', baseTables.waste_types.map(row => ({
      id: String(row.id),
      name: String(row.name),
      unit: 'kg' as const,
      pointPerUnit: Number(row.point_per_unit),
      recycleMethod: String(row.recycle_method),
      status: 'active' as const
    }))),
    /RPC confirm_recycling_submission chưa được triển khai/
  );
  assert.equal(fake.tables.point_history.length, 0);
  assert.equal(fake.tables.recycling_submissions[0].status, 'QR_SCANNED');
  assert.equal(fake.tables.users.find((row: Row) => row.id === 'student-1')?.points, 20);
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
  assert.equal(fake.tables.users.find((row: Row) => row.id === 'student-1')?.points, 60);
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
  assert.deepEqual(fake.tables.qr_scan_logs.slice(0, 3).map((row: Row) => row.result), ['INVALID_TOKEN', 'ALREADY_USED', 'WRONG_STATION']);
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
    assert.equal(fake.calls.find((call: Row) => call.action === 'storageUpload')?.bucket, 'prediction-images');
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

test('Supabase mobile store reports missing mobile tables with actionable setup hint', async () => {
  const fake = makeFakeSupabase(baseTables, { id: 'student-1', email: 'student@school.edu.vn' }, {
    waste_types: 'relation "public.waste_types" does not exist',
    recycling_submissions: 'permission denied for table recycling_submissions'
  });
  const store = createSupabaseMobileStore(fake as any);

  const health = await store.checkSchema();

  assert.equal(health.ok, false);
  assert.deepEqual(health.missingTables, ['waste_types', 'recycling_submissions']);
  assert.match(health.message, /đồng bộ dữ liệu vận hành/);
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
  assert.equal(fake.tables.users.find((row: Row) => row.id === 'student-1')?.points, 120);
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
  assert.equal(fake.tables.users.find((row: Row) => row.id === 'student-1')?.points, 20);
});

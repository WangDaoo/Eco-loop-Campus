import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackendMobileStore } from './backendMobileStore';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}

function response(payload: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: async () => payload,
  };
}

test('backend mobile store signs in through FastAPI auth and stores bearer token', async () => {
  const calls: Array<{ url: string; init?: any }> = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return response({
        token: 'token-1',
        tokenType: 'Bearer',
        user: { id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', status: 'active', points: 0 },
      });
    },
  });

  const user = await store.signIn('student', 'student@school.edu.vn', '123456');

  assert.equal(user.id, 'student-1');
  assert.equal(calls[0].url, 'https://api.example.test/api/auth/login');
  assert.equal(JSON.parse(calls[0].init.body).password, '123456');
});

test('backend mobile store keeps pending volunteer registrations outside app shell', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({
      user: { id: 'volunteer-1', name: 'TN V', email: 'volunteer@school.edu.vn', role: 'volunteer', status: 'pending', points: 0 },
    }, true, 201),
  });

  const user = await store.signUp('TN V', 'volunteer@school.edu.vn', '123456', 'volunteer');

  assert.equal(user.status, 'pending');
});

test('backend mobile store loads initial data from PostgreSQL backend payload', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({
      users: [{ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', status: 'active', points: 5 }],
      stations: [{ id: 'bin-e1', name: 'Trạm E1', binGroup: 'recycle', location: 'Sảnh E1', status: 'active', capacity: 30, qrCode: 'ECL-ST-E1', mapX: 50, mapY: 40 }],
      wasteTypes: [{ id: 'paper', name: 'Giấy', unit: 'kg', pointPerUnit: 5, recycleMethod: 'Tái chế', status: 'active' }],
      predictions: [],
      submissions: [],
      pointTransactions: [],
      feedbacks: [],
      missions: [],
      rewards: [],
      rewardRedemptions: [],
      proofImages: [],
      qrScanLogs: [],
      avatarOptions: [{ key: 'leaf', label: 'Lá xanh', imageUrl: '/uploads/avatars/leaf.png' }],
    }),
  });

  const data = await store.loadInitialData({ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', group: '', points: 0, status: 'active' });

  assert.equal(data.stations[0].id, 'bin-e1');
  assert.equal(data.stations[0].mapX, 50);
  assert.equal(data.avatarOptions[0].imageUrl, 'https://api.example.test/uploads/avatars/leaf.png');
});

test('backend mobile store normalizes relative user avatar URLs from PostgreSQL backend', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({
      users: [{ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', status: 'active', points: 5, avatarKey: 'leaf', avatarUrl: '/uploads/avatars/leaf.png' }],
      stations: [],
      wasteTypes: [],
      predictions: [],
      submissions: [],
      pointTransactions: [],
      feedbacks: [],
      missions: [],
      rewards: [],
      rewardRedemptions: [],
      proofImages: [],
      qrScanLogs: [],
      avatarOptions: [{ key: 'leaf', label: 'Lá xanh', imageUrl: '/uploads/avatars/leaf.png' }],
    }),
  });

  const data = await store.loadInitialData({ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', group: '', points: 0, status: 'active' });

  assert.equal(data.users[0].avatarUrl, 'https://api.example.test/uploads/avatars/leaf.png');
});

test('backend mobile store normalizes selected avatar URL after profile update', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({
      user: { id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', status: 'active', points: 5, avatarKey: 'leaf', avatarUrl: '/uploads/avatars/leaf.png' },
    }),
  });

  const user = await store.updateAvatar('student-1', 'leaf');

  assert.equal(user.avatarUrl, 'https://api.example.test/uploads/avatars/leaf.png');
});

test('backend mobile store creates scans and confirms QR submissions via backend transaction API', async () => {
  const calls: string[] = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    fetcher: async (url, init) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (String(url).endsWith('/api/mobile/recycling-submissions')) {
        return response({ data: { id: 'sub-1', userId: 'student-1', binId: 'bin-e1', wasteTypeId: 'paper', quantity: 1, unit: 'kg', qrToken: 'ECL-SUB-1', status: 'CREATED', createdAt: new Date().toISOString(), expiredAt: new Date(Date.now() + 100000).toISOString() } }, true, 201);
      }
      if (String(url).endsWith('/api/mobile/recycling-submissions/scan')) {
        return response({ data: { result: 'SUCCESS', submissionId: 'sub-1' } });
      }
      return response({ data: { status: 'POINT_CONFIRMED', points: 5, submissionId: 'sub-1' } });
    },
  });

  const submission = await store.createSubmission('student-1', { binId: 'bin-e1', wasteTypeId: 'paper', quantity: 1 }, []);
  const scan = await store.markSubmissionScanned('ECL-SUB-1', 'volunteer-1', 'bin-e1');
  const confirmation = await store.confirmSubmission('sub-1', 1, 'volunteer-1', 'OK', []);

  assert.equal(submission.qrToken, 'ECL-SUB-1');
  assert.equal(scan.result, 'SUCCESS');
  assert.equal(confirmation.submission.status, 'POINT_CONFIRMED');
  assert.equal(confirmation.point.points, 5);
  assert.match(calls.join('\n'), /POST https:\/\/api\.example\.test\/api\/mobile\/recycling-submissions\/sub-1\/confirm/);
});

test('backend mobile store surfaces backend errors without Supabase fallback wording', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({ detail: 'PostgreSQL chưa sẵn sàng' }, false, 503),
  });

  await assert.rejects(
    () => store.signIn('student', 'student@school.edu.vn', '123456'),
    /PostgreSQL chưa sẵn sàng/
  );
});

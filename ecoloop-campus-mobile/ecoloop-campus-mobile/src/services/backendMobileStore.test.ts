import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackendMobileStore } from './backendMobileStore';

class FakeFormData {
  entries: Array<{ name: string; value: unknown }> = [];
  append(name: string, value: unknown) {
    this.entries.push({ name, value });
  }
}

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
  const calls: Array<{ url: string; init?: any }> = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return response({
        user: { id: 'volunteer-1', name: 'TN V', email: 'volunteer@school.edu.vn', role: 'volunteer', status: 'pending', points: 0 },
      }, true, 201);
    },
  });

  const user = await store.signUp('TN V', 'volunteer@school.edu.vn', '123456', 'volunteer', {
    studentCode: 'HYUTEVOL2026',
    facultyCode: 'information-technology',
    phoneNumber: '0912345678',
  });

  assert.equal(user.status, 'pending');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    name: 'TN V',
    email: 'volunteer@school.edu.vn',
    password: '123456',
    role: 'volunteer',
    studentCode: 'HYUTEVOL2026',
    facultyCode: 'information-technology',
    phoneNumber: '0912345678',
  });
});

test('backend mobile store loads faculty catalog and completes a legacy profile', async () => {
  const calls: Array<{ url: string; init?: any }> = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    initialToken: 'token-1',
    storage: memoryStorage(),
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/api/catalog/faculties')) {
        return response({ data: [{ code: 'information-technology', name: 'Khoa Công nghệ thông tin', status: 'active', sortOrder: 4 }] });
      }
      return response({ user: {
        id: 'student-1', name: 'Sinh viên', email: 'student@hyute.edu.vn', role: 'student', status: 'active', points: 0,
        studentCode: 'SV20260001', facultyCode: 'information-technology', facultyName: 'Khoa Công nghệ thông tin',
        phoneNumber: '0912345678', profileCompleted: true, requiresProfileCompletion: false,
      } });
    },
  });

  const faculties = await store.loadFaculties();
  const user = await store.updateProfile({
    studentCode: 'SV20260001',
    facultyCode: 'information-technology',
    phoneNumber: '0912345678',
  });

  assert.equal(faculties[0].name, 'Khoa Công nghệ thông tin');
  assert.equal(user.requiresProfileCompletion, false);
  assert.equal(calls[1].url, 'https://api.example.test/api/users/me/profile');
  assert.equal(calls[1].init.method, 'PATCH');
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
      notifications: [{ id: 'notice-1', userId: 'student-1', type: 'SUBMISSION_REJECTED', title: 'Giao dịch bị từ chối', message: 'Ảnh không đúng loại', referenceType: 'recycling_submission', referenceId: 'sub-1', createdAt: '2026-09-08T09:00:00.000Z' }],
      avatarOptions: [{ key: 'leaf', label: 'Lá xanh', imageUrl: '/uploads/avatars/leaf.png' }],
    }),
  });

  const data = await store.loadInitialData({ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', group: '', points: 0, status: 'active' });

  assert.equal(data.stations[0].id, 'bin-e1');
  assert.equal(data.stations[0].mapX, 50);
  assert.equal(data.avatarOptions[0].imageUrl, 'https://api.example.test/uploads/avatars/leaf.png');
  assert.equal(data.notifications[0].message, 'Ảnh không đúng loại');
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
  const calls: Array<{ line: string; body?: FakeFormData }> = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    FormDataCtor: FakeFormData,
    fetcher: async (url, init) => {
      calls.push({ line: `${init?.method ?? 'GET'} ${url}`, body: init?.body as FakeFormData });
      if (String(url).endsWith('/api/mobile/recycling-submissions')) {
        return response({ data: { submission: { id: 'sub-1', userId: 'student-1', binId: 'bin-e1', wasteTypeId: 'paper', quantity: 1, unit: 'kg', qrToken: 'ECL-SUB-1', status: 'CREATED', createdAt: new Date().toISOString(), expiredAt: new Date(Date.now() + 100000).toISOString() } } }, true, 201);
      }
      if (String(url).endsWith('/api/mobile/recycling-submissions/scan')) {
        return response({ data: { result: 'SUCCESS', submissionId: 'sub-1', submission: { id: 'sub-1', userId: 'student-1', binId: 'bin-e1', wasteTypeId: 'paper', quantity: 1, unit: 'kg', qrToken: 'ECL-SUB-1', status: 'QR_SCANNED', createdAt: new Date().toISOString(), expiredAt: new Date(Date.now() + 100000).toISOString() } } });
      }
      return response({ data: { status: 'POINT_CONFIRMED', points: 5, submissionId: 'sub-1', submission: { id: 'sub-1', userId: 'student-1', binId: 'bin-e1', wasteTypeId: 'paper', quantity: 1, unit: 'kg', qrToken: 'ECL-SUB-1', status: 'POINT_CONFIRMED', createdAt: new Date().toISOString(), expiredAt: new Date(Date.now() + 100000).toISOString() } } });
    },
  });

  const submission = await store.createSubmission('student-1', {
    binId: 'bin-e1',
    wasteTypeId: 'paper',
    quantity: 1,
    proof: { uri: 'file:///proof.jpg', name: 'proof.jpg', mimeType: 'image/jpeg' }
  }, []);
  const scan = await store.markSubmissionScanned('ECL-SUB-1', 'volunteer-1', 'bin-e1');
  const confirmation = await store.confirmSubmission('sub-1', 1, 'volunteer-1', 'OK', []);

  assert.equal(submission.qrToken, 'ECL-SUB-1');
  assert.equal(scan.result, 'SUCCESS');
  assert.equal(confirmation.submission.status, 'POINT_CONFIRMED');
  assert.equal(confirmation.point.points, 5);
  assert.deepEqual(calls[0].body?.entries.map(entry => entry.name), ['binId', 'wasteTypeId', 'quantity', 'proof']);
  assert.match(calls.map(call => call.line).join('\n'), /POST https:\/\/api\.example\.test\/api\/mobile\/recycling-submissions\/sub-1\/confirm/);
});

test('backend mobile store refuses to create a QR without student proof', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    FormDataCtor: FakeFormData,
    fetcher: async () => response({ data: {} }, true, 201),
  });

  await assert.rejects(
    () => store.createSubmission('student-1', { binId: 'bin-e1', wasteTypeId: 'paper', quantity: 1 }, []),
    /ảnh minh chứng/i
  );
});

test('backend mobile store unlocks manual review with a required reason and marks notifications read', async () => {
  const calls: Array<{ url: string; init?: any }> = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/manual-review')) {
        return response({ data: { submission: { id: 'sub-1', userId: 'student-1', binId: 'bin-1', wasteTypeId: 'paper', quantity: 1, unit: 'kg', qrToken: 'ECL-SUB-1', status: 'PENDING_REVIEW', createdAt: '2026-09-08T09:00:00.000Z', expiredAt: '2026-09-08T09:45:00.000Z', manualReviewReason: 'Camera không đọc được mã' } } });
      }
      return response({ data: { id: 'notice-1', userId: 'student-1', type: 'SUBMISSION_REJECTED', title: 'Bị từ chối', message: 'Ảnh mờ', referenceType: 'recycling_submission', referenceId: 'sub-1', readAt: '2026-09-08T10:00:00.000Z', createdAt: '2026-09-08T09:00:00.000Z' } });
    },
  });

  const submission = await store.unlockManualReview('sub-1', 'Camera không đọc được mã');
  const notification = await store.markNotificationRead('notice-1');

  assert.equal(submission.status, 'PENDING_REVIEW');
  assert.equal(notification.readAt?.toISOString(), '2026-09-08T10:00:00.000Z');
  assert.deepEqual(JSON.parse(calls[0].init.body), { reason: 'Camera không đọc được mã' });
  assert.equal(calls[1].init.method, 'PATCH');
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

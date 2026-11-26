import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackendMobileStore, isSessionExpiredError } from './backendMobileStore';

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
      avatarOptions: [{ key: 'leaf', label: 'Lá xanh', imageUrl: '/uploads/avatars/leaf.png' }],
    }),
  });

  const data = await store.loadInitialData({ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', group: '', points: 0, status: 'active' });

  assert.equal(data.stations[0].id, 'bin-e1');
  assert.equal(data.stations[0].mapX, 50);
  assert.equal(data.avatarOptions[0].imageUrl, 'https://api.example.test/uploads/avatars/leaf.png');
});

test('backend mobile store prefers currentUser from polling data for live point refresh', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({
      currentUser: { id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', status: 'active', points: 25 },
      users: [{ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', status: 'active', points: 5 }],
      stations: [],
      wasteTypes: [],
      predictions: [],
      submissions: [{
        id: 'sub-1',
        userId: 'student-1',
        binId: 'bin-e1',
        wasteTypeId: 'paper',
        quantity: 1,
        unit: 'kg',
        qrToken: 'ECL-SUB-1',
        status: 'POINT_CONFIRMED',
        createdAt: '2026-09-13T10:00:00.000Z',
        expiredAt: '2026-09-13T10:45:00.000Z',
        actualQuantity: 1,
      }],
      pointTransactions: [{ id: 'point-1', userId: 'student-1', submissionId: 'sub-1', points: 20, source: 'qr_submission', status: 'confirmed' }],
      feedbacks: [],
      missions: [],
      rewards: [],
      rewardRedemptions: [],
      proofImages: [],
      qrScanLogs: [],
      avatarOptions: [],
    }),
  });

  const data = await store.loadInitialData({ id: 'student-1', name: 'Sinh viên', email: 'student@school.edu.vn', role: 'student', group: '', points: 5, status: 'active' });

  assert.equal(data.users[0].id, 'student-1');
  assert.equal(data.users[0].points, 25);
  assert.equal(data.submissions[0].status, 'POINT_CONFIRMED');
  assert.equal(data.pointTransactions[0].submissionId, 'sub-1');
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

test('backend mobile store normalizes saved prediction image URLs for native image preview', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    fetcher: async (url) => {
      if (String(url).endsWith('/api/uploads/predictions')) {
        return response({ data: { imageUrl: '/uploads/predictions/2026-09-13/bottle.jpg', imageName: 'bottle.jpg' } }, true, 201);
      }
      return response({
        data: {
          id: 'prediction-1',
          class: 'plastic',
          confidence: 0.92,
          source: 'upload',
          imageUrl: '/uploads/predictions/2026-09-13/bottle.jpg',
          imageName: 'bottle.jpg',
        },
      }, true, 201);
    },
  });

  const prediction = await store.saveAiPrediction('student-1', {
    className: 'plastic',
    confidence: 0.92,
    source: 'upload',
    imageUri: 'file:///tmp/bottle.jpg',
    imageName: 'bottle.jpg',
    mimeType: 'image/jpeg',
  });

  assert.equal(prediction.imageUrl, 'https://api.example.test/uploads/predictions/2026-09-13/bottle.jpg');
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

test('backend mobile store maps proof image backend error to a helpful QR message', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    fetcher: async () => response({ detail: 'PROOF_IMAGE_REQUIRED', code: 'PROOF_IMAGE_REQUIRED' }, false, 400),
  });

  await assert.rejects(
    () => store.createSubmission('student-1', { binId: 'bin-1', wasteTypeId: 'paper', quantity: 1 }, []),
    /Hãy chụp ảnh hoặc tải ảnh rác lên trước khi tạo mã QR/
  );
});

test('backend mobile store translates reward and scan business error codes into Vietnamese', async () => {
  const codes: Record<string, RegExp> = {
    ACTIVE_REWARD_BATCH_EXISTS: /đang có một mã đổi thưởng/i,
    REWARD_OUT_OF_STOCK: /hết hàng/i,
    INSUFFICIENT_POINTS: /không đủ Ecopoint/i,
    INVALID_SUBMISSION_STATUS: /trạng thái/i,
    SUBMISSION_ACTOR_MISMATCH: /tình nguyện viên khác/i,
  };
  for (const [code, pattern] of Object.entries(codes)) {
    const store = createBackendMobileStore({
      baseUrl: 'https://api.example.test',
      storage: memoryStorage(),
      initialToken: 'token-1',
      fetcher: async () => response({ detail: code }, false, 409),
    });
    await assert.rejects(() => store.requestRewardBatch('student-1', [{ rewardId: 'r1', quantity: 1 }], []), pattern);
    await assert.rejects(
      () => store.requestRewardBatch('student-1', [{ rewardId: 'r1', quantity: 1 }], []),
      (error: unknown) => {
        const failure = error as { code?: string; status?: number; message: string };
        assert.equal(failure.code, code);
        assert.equal(failure.status, 409);
        assert.doesNotMatch(failure.message, new RegExp(code));
        return true;
      }
    );
  }
});

test('backend mobile store marks expired sessions and clears the stored token on 401', async () => {
  const storage = memoryStorage();
  await storage.setItem('ecoloop_backend_token', 'token-1');
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage,
    fetcher: async () => response({ detail: 'Invalid token' }, false, 401),
  });

  await assert.rejects(() => store.loadInitialData({ id: 'student-1', role: 'student' } as any), (error: unknown) => {
    assert.equal(isSessionExpiredError(error), true);
    assert.match((error as Error).message, /Phiên đăng nhập đã hết hạn/);
    return true;
  });
  assert.equal(await storage.getItem('ecoloop_backend_token'), null);
});

test('backend mobile store keeps wrong-password login errors separate from session expiry', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    fetcher: async () => response({ detail: 'Sai email hoặc mật khẩu' }, false, 401),
  });

  await assert.rejects(() => store.signIn('student', 'a@b.vn', 'x'), (error: unknown) => {
    assert.equal(isSessionExpiredError(error), false);
    assert.match((error as Error).message, /Sai email hoặc mật khẩu/);
    return true;
  });
});

test('backend mobile store gives up on hung requests with a friendly timeout error', async () => {
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    requestTimeoutMs: 20,
    fetcher: (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    }),
  });

  await assert.rejects(() => store.checkSchema(), /Máy chủ phản hồi quá lâu/);
});

test('backend mobile store sends proof image paths relative to the backend', async () => {
  const bodies: any[] = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test/',
    storage: memoryStorage(),
    initialToken: 'token-1',
    fetcher: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return response({ data: { id: 'sub-1', qrToken: 'ECL-SUB-1', status: 'CREATED' } }, true, 201);
    },
  });

  await store.createSubmission('student-1', {
    binId: 'bin-1',
    wasteTypeId: 'paper',
    quantity: 1,
    proofImageUrl: 'https://api.example.test/uploads/predictions/2026-11-26/bottle.jpg',
  }, []);

  assert.equal(bodies[0].proofImageUrl, '/uploads/predictions/2026-11-26/bottle.jpg');
});

test('backend mobile store uploads a submission photo without requiring an AI prediction', async () => {
  const calls: string[] = [];
  const store = createBackendMobileStore({
    baseUrl: 'https://api.example.test',
    storage: memoryStorage(),
    initialToken: 'token-1',
    fetcher: async (url) => {
      calls.push(String(url));
      return response({ data: { imageUrl: '/uploads/predictions/2026-11-26/can.jpg' } }, true, 201);
    },
  });

  const imageUrl = await store.uploadSubmissionPhoto({ imageUri: 'file:///tmp/can.jpg', imageName: 'can.jpg', mimeType: 'image/jpeg' });

  assert.equal(imageUrl, '/uploads/predictions/2026-11-26/can.jpg');
  assert.deepEqual(calls, ['https://api.example.test/api/uploads/predictions']);
});

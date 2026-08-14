type Env = Record<string, string | undefined>;

type TestAccount = {
  email: string;
  password: string;
};

export type SupabaseSmokeConfig =
  | {
      ok: true;
      url: string;
      publishableKey: string;
      student: TestAccount;
      volunteer?: TestAccount;
      writeMode: boolean;
    }
  | {
      ok: false;
      missing: string[];
      message: string;
    };

function value(env: Env, key: string) {
  return String(env[key] ?? '').trim();
}

export function readSupabaseSmokeConfig(env: Env): SupabaseSmokeConfig {
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_TEST_STUDENT_EMAIL',
    'EXPO_PUBLIC_TEST_STUDENT_PASSWORD'
  ];
  const missing = required.filter(key => !value(env, key));

  if (missing.length) {
    return {
      ok: false,
      missing,
      message: `Thieu bien moi truong smoke test: ${missing.join(', ')}. Them vao .env va tao Supabase Auth users student/volunteer tuong ung truoc khi chay smoke; khong in Supabase key ra log.`
    };
  }

  const volunteerEmail = value(env, 'EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL');
  const volunteerPassword = value(env, 'EXPO_PUBLIC_TEST_VOLUNTEER_PASSWORD');
  const writeMode = value(env, 'EXPO_PUBLIC_SMOKE_WRITE') === '1';

  if (writeMode && (!volunteerEmail || !volunteerPassword)) {
    const missing = [
      !volunteerEmail ? 'EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL' : '',
      !volunteerPassword ? 'EXPO_PUBLIC_TEST_VOLUNTEER_PASSWORD' : ''
    ].filter(Boolean);
    return {
      ok: false,
      missing,
      message: `Thieu bien moi truong smoke write mode: ${missing.join(', ')}. Write mode can volunteer account.`
    };
  }

  return {
    ok: true,
    url: value(env, 'EXPO_PUBLIC_SUPABASE_URL'),
    publishableKey: value(env, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    student: {
      email: value(env, 'EXPO_PUBLIC_TEST_STUDENT_EMAIL'),
      password: value(env, 'EXPO_PUBLIC_TEST_STUDENT_PASSWORD')
    },
    volunteer: volunteerEmail && volunteerPassword ? { email: volunteerEmail, password: volunteerPassword } : undefined,
    writeMode
  };
}

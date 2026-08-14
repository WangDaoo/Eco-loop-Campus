import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import nodeProcess from 'node:process';
import { createSupabaseMobileStore } from '../src/services/supabaseMobileStore';
import { readSupabaseSmokeConfig } from '../src/services/supabaseSmokeConfig';
import { runSupabaseWriteSmoke } from '../src/services/supabaseSmokeFlow';

function loadDotEnv() {
  const envPath = resolve('.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    if (!nodeProcess.env[key]) nodeProcess.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  });
}

async function main() {
  loadDotEnv();
  const config = readSupabaseSmokeConfig(nodeProcess.env);
  if (!config.ok) {
    console.log(config.message);
    (nodeProcess as any).exitCode = 1;
    return;
  }

  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const store = createSupabaseMobileStore(client as any);

  const student = await store.signIn('student', config.student.email, config.student.password);
  const schema = await store.checkSchema();
  if (!schema.ok) throw new Error(schema.message);

  const data = await store.loadInitialData(student);
  const readiness = store.getOperatingReadiness(data);
  if (!readiness.ok) throw new Error(`Supabase thieu du lieu van hanh: ${readiness.missing.join(', ')}`);

  console.log(`OK student=${student.email} stations=${data.stations.length} wasteTypes=${data.wasteTypes.length} rewards=${data.rewards.length} submissions=${data.submissions.length}`);

  if (config.writeMode) {
    if (!config.volunteer) throw new Error('Write smoke can volunteer account.');
    const result = await runSupabaseWriteSmoke(store, student, data, config.volunteer);
    console.log(`OK write-flow submission=${result.submissionId} qr=${result.qrToken} proof=${result.proofId} points=${result.points}`);
    return;
  }

  if (!config.volunteer) {
    console.log('Read-only smoke done. Set EXPO_PUBLIC_SMOKE_WRITE=1 to test QR/proof/confirm flow.');
    return;
  }
  await store.signOut();
  const volunteer = await store.signIn('volunteer', config.volunteer.email, config.volunteer.password);
  console.log(`OK volunteer=${volunteer.email}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  (nodeProcess as any).exitCode = 1;
});

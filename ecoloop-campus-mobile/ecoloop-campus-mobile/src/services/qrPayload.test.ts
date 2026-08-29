import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStationQrCode, buildStationQrPayload, buildSubmissionQrPayload, extractStationQrCandidates, extractStationQrCode, extractSubmissionQrToken } from './qrPayload';

test('extractSubmissionQrToken accepts a plain Eco-loop v1 token and legacy tokens', () => {
  assert.equal(extractSubmissionQrToken(' ecl-sub-20260812112233-123456 '), 'ECL-SUB-20260812112233-123456');
  assert.equal(extractSubmissionQrToken(' eco-20260812112233-123456 '), 'ECO-20260812112233-123456');
});

test('extractSubmissionQrToken reads token from JSON QR payload v1', () => {
  const payload = JSON.stringify({ type: 'eco-loop-submission', version: 1, qrToken: 'ECL-SUB-20260812112233-000001' });

  assert.equal(extractSubmissionQrToken(payload), 'ECL-SUB-20260812112233-000001');
});

test('extractSubmissionQrToken reads token from deep link URL payload', () => {
  const payload = 'ecoloop://submission/verify?token=ECO-SUB-002&station=bin-1';

  assert.equal(extractSubmissionQrToken(payload), 'ECO-SUB-002');
});

test('buildSubmissionQrPayload keeps token scan-compatible and includes v1 metadata', () => {
  const payload = buildSubmissionQrPayload({ qrToken: 'ECL-SUB-20260812112233-000003', id: 'sub-3', binId: 'bin-1', expiredAt: new Date('2026-08-23T10:00:00.000Z') });
  const parsed = JSON.parse(payload);

  assert.equal(extractSubmissionQrToken(payload), 'ECL-SUB-20260812112233-000003');
  assert.equal(parsed.type, 'eco-loop-submission');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.expiredAt, '2026-08-23T10:00:00.000Z');
});

test('station QR helpers build and read Eco-loop station payload v1', () => {
  assert.equal(buildStationQrCode('station e1'), 'ECL-ST-STATION-E1');
  const payload = buildStationQrPayload({ id: 'station-e1', qrCode: 'ECL-ST-STATION-E1' });
  const parsed = JSON.parse(payload);

  assert.equal(parsed.type, 'eco-loop-station');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.stationId, 'station-e1');
  assert.equal(extractStationQrCode(payload), 'ECL-ST-STATION-E1');
  assert.equal(extractStationQrCode(' station-e1 '), 'STATION-E1');
  assert.equal(extractStationQrCode('ecoloop://station/select?station=station-caf'), 'STATION-CAF');
});

test('station QR candidates include station id when the stored QR code is out of sync', () => {
  const payload = JSON.stringify({
    type: 'eco-loop-station',
    version: 1,
    stationId: 'station-e1',
    qrCode: 'ECL-ST-OLD-E1'
  });

  assert.deepEqual(extractStationQrCandidates(payload), ['ECL-ST-OLD-E1', 'STATION-E1']);
});

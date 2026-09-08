import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProofFirstSubmissionInput } from './submitProofFlow';

test('submission input keeps the selected student proof when AI has no result', () => {
  const input = buildProofFirstSubmissionInput({
    binId: 'bin-1',
    wasteTypeId: 'paper',
    quantity: 2,
    proofAsset: {
      uri: 'file:///student-proof.jpg',
      fileName: 'student-proof.jpg',
      mimeType: 'image/jpeg',
    },
    predictionId: undefined,
  });

  assert.deepEqual(input, {
    binId: 'bin-1',
    wasteTypeId: 'paper',
    quantity: 2,
    predictionId: undefined,
    proof: {
      uri: 'file:///student-proof.jpg',
      name: 'student-proof.jpg',
      mimeType: 'image/jpeg',
    },
  });
});

test('submission input links the optional AI prediction to the same proof', () => {
  const input = buildProofFirstSubmissionInput({
    binId: 'bin-1',
    wasteTypeId: 'plastic',
    quantity: 1,
    proofAsset: { uri: 'content://camera/42' },
    predictionId: 'prediction-1',
  });

  assert.equal(input.predictionId, 'prediction-1');
  assert.deepEqual(input.proof, {
    uri: 'content://camera/42',
    name: 'student-proof.jpg',
    mimeType: 'image/jpeg',
  });
});

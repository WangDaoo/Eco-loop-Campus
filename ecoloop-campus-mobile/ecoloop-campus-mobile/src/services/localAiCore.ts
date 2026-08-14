import { PredictionResult } from './predictionService';

export const MODEL_INPUT_SIZE = 224;

export const wasteLabels = [
  'battery',
  'biological',
  'cardboard',
  'clothes',
  'glass',
  'metal',
  'paper',
  'plastic',
  'shoes',
  'trash'
];

export function rgbBytesToFloatTensor(rgb: ArrayLike<number>) {
  const tensor = new Float32Array(rgb.length);
  for (let index = 0; index < rgb.length; index += 1) {
    tensor[index] = Math.max(0, Math.min(255, Number(rgb[index]) || 0)) / 255;
  }
  return tensor;
}

export function parseTfliteClassification(scores: ArrayLike<number>): PredictionResult {
  if (scores.length !== wasteLabels.length) {
    throw new Error(`TFLite trả về ${scores.length} class, cần ${wasteLabels.length} class.`);
  }

  let bestIndex = 0;
  let bestScore = Number(scores[0]) || 0;
  for (let index = 1; index < scores.length; index += 1) {
    const score = Number(scores[index]) || 0;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  const confidence = Math.round(Math.max(0, Math.min(1, bestScore)) * 10000) / 10000;
  return {
    className: wasteLabels[bestIndex],
    confidence,
    confidencePercent: Math.round(confidence * 100)
  };
}

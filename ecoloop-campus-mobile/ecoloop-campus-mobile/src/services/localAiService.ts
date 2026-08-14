import { PickedImage, PredictionResult } from './predictionService';
export { parseTfliteClassification, rgbBytesToFloatTensor } from './localAiCore';

const missingNativeRuntimeMessage = 'On-device AI cần Android dev build có native TFLite module. Expo Go sẽ dùng FastAPI fallback.';

export function createLocalAiService() {
  return {
    isAvailable() {
      return false;
    },

    async predictImage(_image: PickedImage): Promise<PredictionResult> {
      throw new Error(missingNativeRuntimeMessage);
    }
  };
}

export const localAiService = createLocalAiService();

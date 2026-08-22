import { PickedImage, PredictionResult } from './predictionService';
export { parseTfliteClassification, rgbBytesToFloatTensor } from './localAiCore';

const missingNativeRuntimeMessage = 'AI trên thiết bị chưa sẵn sàng. Hệ thống sẽ dùng dịch vụ AI trực tuyến.';

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

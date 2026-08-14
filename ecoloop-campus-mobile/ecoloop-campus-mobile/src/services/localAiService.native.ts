import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { convertToRGB } from 'react-native-image-to-rgb';
import { PickedImage, PredictionResult } from './predictionService';
import { MODEL_INPUT_SIZE, parseTfliteClassification, rgbBytesToFloatTensor } from './localAiCore';

export { parseTfliteClassification, rgbBytesToFloatTensor } from './localAiCore';

const modelAsset = require('../assets/ai/mobilenetv2_waste_float32.tflite');
let modelPromise: Promise<TensorflowModel> | undefined;

async function getModel() {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(modelAsset, 'default');
  }
  return modelPromise;
}

async function prepareImageForModel(image: PickedImage) {
  const resized = await manipulateAsync(
    image.uri,
    [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
    { compress: 0.9, format: SaveFormat.JPEG }
  );
  const rgb = await convertToRGB(resized.uri);
  const expectedLength = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3;
  if (rgb.length !== expectedLength) {
    throw new Error(`Ảnh sau tiền xử lý có ${rgb.length} giá trị RGB, cần ${expectedLength}.`);
  }
  return rgbBytesToFloatTensor(rgb);
}

export function createLocalAiService() {
  return {
    isAvailable() {
      return process.env.EXPO_PUBLIC_AI_MODE === 'local-first';
    },

    async predictImage(image: PickedImage): Promise<PredictionResult> {
      const [model, input] = await Promise.all([getModel(), prepareImageForModel(image)]);
      const outputs = await model.run([input]);
      const firstOutput = outputs[0];
      if (!firstOutput) throw new Error('TFLite không trả về output.');
      return parseTfliteClassification(firstOutput as ArrayLike<number>);
    }
  };
}

export const localAiService = createLocalAiService();

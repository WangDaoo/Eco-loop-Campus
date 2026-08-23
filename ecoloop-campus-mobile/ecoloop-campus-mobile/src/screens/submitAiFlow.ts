import { aiClassDisplayName, PredictionResult } from '../services/predictionService';
import { PredictionRecord, PredictionSource, SavePredictionInput, WasteType } from '../types';

export type SubmitAiAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type SubmitAiSuggestion = PredictionResult & {
  predictedClass: string;
  predictionId?: string;
  sourceUri?: string;
  wasteType?: WasteType;
  note?: string;
  saveWarning?: string;
};

type BuildSubmitAiSuggestionInput = {
  asset: SubmitAiAsset;
  source: PredictionSource;
  stationId?: string;
  wasteTypes: WasteType[];
  predictImage(input: { uri: string; name: string; mimeType: string }): Promise<PredictionResult>;
  saveAiPrediction(input: SavePredictionInput): Promise<PredictionRecord | undefined>;
  suggestWasteTypeFromClass(className: string, wasteTypes: WasteType[]): WasteType | undefined;
  messageOf(error: unknown): string;
};

export async function buildSubmitAiSuggestion({
  asset,
  source,
  stationId,
  wasteTypes,
  predictImage,
  saveAiPrediction,
  suggestWasteTypeFromClass,
  messageOf
}: BuildSubmitAiSuggestionInput): Promise<SubmitAiSuggestion> {
  const imageName = asset.fileName ?? 'waste-capture.jpg';
  const mimeType = asset.mimeType ?? 'image/jpeg';
  const prediction = await predictImage({ uri: asset.uri, name: imageName, mimeType });
  const wasteType = suggestWasteTypeFromClass(prediction.className, wasteTypes);
  const displayClass = aiClassDisplayName(prediction.className);
  let savedPrediction: PredictionRecord | undefined;
  let saveWarning: string | undefined;

  try {
    savedPrediction = await saveAiPrediction({
      className: prediction.className,
      confidence: prediction.confidence,
      source,
      binId: stationId,
      imageUri: asset.uri,
      imageName,
      mimeType
    });
  } catch (error) {
    saveWarning = `AI đã nhận diện thành công nhưng chưa lưu được kết quả: ${messageOf(error)}`;
  }

  const note = !wasteType
    ? `AI nhận diện là ${displayClass}, nhưng danh mục hiện chưa có loại rác tương ứng. Hãy chọn thủ công.`
    : prediction.confidence < 0.65
      ? 'Độ tin cậy thấp. Nên để tình nguyện viên kiểm tra kỹ trước khi xác nhận Ecopoint.'
      : 'AI chỉ hỗ trợ gợi ý. Ecopoint vẫn cần tình nguyện viên xác nhận.';

  return {
    ...prediction,
    predictedClass: displayClass,
    predictionId: savedPrediction?.id,
    sourceUri: asset.uri,
    wasteType,
    note,
    saveWarning
  };
}

import { aiClassDisplayName, PredictionResult } from '../services/predictionService';
import { PredictionRecord, PredictionSource, RecyclingSubmission, SavePredictionInput, WasteType } from '../types';

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
    sourceUri: savedPrediction?.imageUrl,
    wasteType,
    note,
    saveWarning
  };
}

export const MISSING_SUBMISSION_PHOTO_MESSAGE = 'Hãy chụp ảnh hoặc tải ảnh rác lên trước khi tạo mã QR.';

export type SubmissionPhoto = {
  localUri: string;
  imageName: string;
  mimeType: string;
  uploadedUrl?: string;
};

export function toSubmissionPhoto(asset: SubmitAiAsset): SubmissionPhoto {
  return {
    localUri: asset.uri,
    imageName: asset.fileName ?? 'waste-capture.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg'
  };
}

/**
 * Ảnh rác là minh chứng bắt buộc nhưng không phụ thuộc AI: nếu AI đã lưu ảnh thì dùng lại đường dẫn đó,
 * nếu AI lỗi hoặc chưa lưu được thì tải ảnh gốc lên máy chủ ngay khi tạo mã QR.
 */
export async function ensureSubmissionPhotoUrl(
  photo: SubmissionPhoto | null | undefined,
  upload: (input: { imageUri: string; imageName?: string; mimeType?: string }) => Promise<string>
) {
  if (!photo?.localUri) throw new Error(MISSING_SUBMISSION_PHOTO_MESSAGE);
  if (photo.uploadedUrl) return photo.uploadedUrl;
  return upload({ imageUri: photo.localUri, imageName: photo.imageName, mimeType: photo.mimeType });
}

/** Cùng công thức với backend: ceil(số lượng × điểm/đơn vị), loại bỏ sai số dấu phẩy động. */
export function estimateSubmissionPoints(quantity: number, pointPerUnit: number | undefined) {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(pointPerUnit ?? NaN)) return 0;
  return Math.max(0, Math.ceil(Number((quantity * (pointPerUnit as number)).toFixed(6))));
}

/** Mã QR còn hiệu lực gần nhất của sinh viên, dùng để hiện lại sau khi mở lại app. */
export function findRestorableSubmission(submissions: RecyclingSubmission[], userId: string, now: Date = new Date()) {
  if (!userId) return undefined;
  return submissions
    .filter(item => item.userId === userId && (item.status === 'CREATED' || item.status === 'QR_SCANNED') && item.expiredAt.getTime() > now.getTime())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

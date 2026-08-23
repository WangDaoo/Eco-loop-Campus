import { WasteType } from '../types';
import { AiRuntimeMode, createAiRuntime, LocalAiEngine } from './aiRuntime';

export type PickedImage = {
  uri: string;
  name?: string;
  mimeType?: string;
  type?: string;
};

export type PredictionResult = {
  className: string;
  confidence: number;
  confidencePercent: number;
  runtime?: 'local' | 'remote';
  fallbackReason?: string;
};

type FormDataLike = {
  append(name: string, value: unknown): void;
};

type FormDataConstructor = new () => FormDataLike;

type FetchResponseLike = {
  ok?: boolean;
  status?: number;
  json(): Promise<Record<string, unknown>>;
};

type FetchLike = (url: string, init: { method: string; body?: FormDataLike; signal?: AbortSignal }) => Promise<FetchResponseLike>;

type PredictionServiceOptions = {
  baseUrl?: string;
  fetcher?: FetchLike;
  FormDataCtor?: FormDataConstructor;
  aiMode?: AiRuntimeMode;
  localEngine?: LocalAiEngine;
  queueTimeoutMs?: number;
  pollIntervalMs?: number;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
};

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fileNameFor(image: PickedImage) {
  if (image.name?.trim()) return image.name.trim();
  const fromUri = image.uri.split('/').filter(Boolean).pop();
  return fromUri?.includes('.') ? fromUri : 'waste-capture.jpg';
}

function aiModeFromEnv(): AiRuntimeMode {
  return process.env.EXPO_PUBLIC_AI_MODE === 'local-first' ? 'local-first' : 'remote';
}

function waitFor(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function normalizePredictionPayload(payload: Record<string, unknown>): PredictionResult {
  if (payload.error) throw new Error(String(payload.error));

  const className = String(payload.class ?? '').trim().toLowerCase();
  if (!className) throw new Error('AI chưa trả về kết quả phân loại');

  const confidence = Math.max(0, Math.min(1, number(payload.confidence)));
  return {
    className,
    confidence,
    confidencePercent: Math.round(confidence * 100)
  };
}

function isPredictionPayload(payload: Record<string, unknown>) {
  return Boolean(payload.class || payload.error || Object.prototype.hasOwnProperty.call(payload, 'confidence'));
}


export function createPredictionService({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000',
  fetcher = fetch as unknown as FetchLike,
  FormDataCtor = FormData as unknown as FormDataConstructor,
  aiMode = aiModeFromEnv(),
  localEngine,
  queueTimeoutMs = 45000,
  pollIntervalMs = 1000,
  wait = waitFor,
  now = Date.now
}: PredictionServiceOptions = {}) {
  const remoteEngine = {
    async predictImage(image: PickedImage): Promise<PredictionResult> {
      if (!image.uri.trim()) throw new Error('Ảnh không hợp lệ');

      const formData = new FormDataCtor();
      formData.append('file', {
        uri: image.uri,
        name: fileNameFor(image),
        type: image.mimeType ?? image.type ?? 'image/jpeg'
      });

      const endpointBaseUrl = normalizedBaseUrl(baseUrl);

      const postDirectPrediction = async () => {
        const response = await fetcher(`${endpointBaseUrl}/predict`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Dịch vụ AI tạm thời chưa sẵn sàng${response.status ? ` (${response.status})` : ''}`);
        }

        return normalizePredictionPayload(await response.json());
      };

      const pollPredictionJob = async (jobId: string) => {
        const deadline = now() + queueTimeoutMs;
        while (now() <= deadline) {
          const response = await fetcher(`${endpointBaseUrl}/predict/jobs/${jobId}`, { method: 'GET' });
          if (!response.ok) {
            throw new Error(`Dịch vụ AI tạm thời chưa sẵn sàng${response.status ? ` (${response.status})` : ''}`);
          }
          const payload = await response.json();
          if (payload.status === 'done') return normalizePredictionPayload(payload);
          if (payload.status === 'failed') throw new Error(String(payload.error || 'AI xử lý ảnh không thành công'));
          await wait(pollIntervalMs);
        }
        throw new Error('AI xử lý lâu hơn dự kiến. Bạn có thể chọn loại rác thủ công.');
      };

      const submitQueuedPrediction = async () => {
        const response = await fetcher(`${endpointBaseUrl}/predict/jobs`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          if (response.status === 429) throw new Error('Hệ thống AI đang bận, vui lòng thử lại sau.');
          if (response.status === 404 || response.status === 405) return postDirectPrediction();
          throw new Error(`Dịch vụ AI tạm thời chưa sẵn sàng${response.status ? ` (${response.status})` : ''}`);
        }

        const payload = await response.json();
        if (isPredictionPayload(payload)) return normalizePredictionPayload(payload);

        const jobId = String(payload.job_id ?? '').trim();
        if (!jobId) return postDirectPrediction();
        return pollPredictionJob(jobId);
      };

      try {
        return await submitQueuedPrediction();
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('AI xử lý lâu hơn dự kiến. Bạn có thể chọn loại rác thủ công.');
        }
        throw err;
      }
    }
  };

  return createAiRuntime({ mode: aiMode, localEngine, remoteEngine });
}

export const predictionService = createPredictionService();

export function binGroupForAiClass(className: string) {
  const normalized = className.trim().toLowerCase();
  if (normalized === 'biological') return 'Hữu cơ';
  if (['paper', 'cardboard', 'plastic', 'glass', 'metal'].includes(normalized)) return 'Tái chế';
  if (normalized === 'battery') return 'Pin / nguy hại';
  return 'Còn lại';
}

export function suggestWasteTypeFromClass(className: string, wasteTypes: WasteType[]) {
  const normalized = className.trim().toLowerCase();
  const exact = wasteTypes.find(item => item.id.toLowerCase() === normalized || item.name.toLowerCase() === normalized);
  if (exact) return exact;

  const candidates: Record<string, string[]> = {
    plastic: ['plastic', 'nhua', 'chai'],
    paper: ['paper', 'cardboard', 'giay', 'carton'],
    cardboard: ['paper', 'cardboard', 'giay', 'carton'],
    metal: ['metal', 'lon', 'kim loai'],
    biological: ['organic', 'huu co', 'sinh hoc']
  };
  const keywords = candidates[normalized] ?? [];
  return wasteTypes.find(item => {
    const haystack = `${item.id} ${item.name}`.toLowerCase();
    return keywords.some(keyword => haystack.includes(keyword));
  });
}

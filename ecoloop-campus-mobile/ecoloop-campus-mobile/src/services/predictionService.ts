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

type FetchLike = (url: string, init: { method: string; body: FormDataLike }) => Promise<FetchResponseLike>;

type PredictionServiceOptions = {
  baseUrl?: string;
  fetcher?: FetchLike;
  FormDataCtor?: FormDataConstructor;
  aiMode?: AiRuntimeMode;
  localEngine?: LocalAiEngine;
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


export function createPredictionService({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000',
  fetcher = fetch as unknown as FetchLike,
  FormDataCtor = FormData as unknown as FormDataConstructor,
  aiMode = aiModeFromEnv(),
  localEngine
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetcher(`${normalizedBaseUrl(baseUrl)}/predict`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        } as any);
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Backend AI lỗi HTTP ${response.status ?? ''}`);
        }

        const payload = await response.json();
        if (payload.error) throw new Error(String(payload.error));

        const className = String(payload.class ?? '').trim().toLowerCase();
        if (!className) throw new Error('Backend AI không trả về class');

        const confidence = Math.max(0, Math.min(1, number(payload.confidence)));
        return {
          className,
          confidence,
          confidencePercent: Math.round(confidence * 100)
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Kết nối đến Backend AI quá hạn (Timeout). Kiểm tra mạng hoặc IP máy chủ.');
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

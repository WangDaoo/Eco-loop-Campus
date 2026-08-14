import { PickedImage, PredictionResult } from './predictionService';

export type AiRuntimeMode = 'remote' | 'local-first';

export type RuntimePredictionResult = PredictionResult & {
  runtime: 'local' | 'remote';
  fallbackReason?: string;
};

export type AiEngine = {
  predictImage(image: PickedImage): Promise<PredictionResult | RuntimePredictionResult>;
};

export type LocalAiEngine = AiEngine & {
  isAvailable(): boolean;
};

type CreateAiRuntimeOptions = {
  mode?: AiRuntimeMode;
  localEngine?: LocalAiEngine;
  remoteEngine: AiEngine;
};

function withRuntime(result: PredictionResult | RuntimePredictionResult, runtime: 'local' | 'remote', fallbackReason?: string): RuntimePredictionResult {
  return {
    ...result,
    runtime,
    fallbackReason
  };
}

export function createAiRuntime({ mode = 'remote', localEngine, remoteEngine }: CreateAiRuntimeOptions) {
  return {
    async predictImage(image: PickedImage): Promise<RuntimePredictionResult> {
      if (mode !== 'local-first') {
        return withRuntime(await remoteEngine.predictImage(image), 'remote');
      }

      if (!localEngine?.isAvailable()) {
        return withRuntime(await remoteEngine.predictImage(image), 'remote', 'On-device AI chưa khả dụng trong runtime hiện tại.');
      }

      try {
        return withRuntime(await localEngine.predictImage(image), 'local');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return withRuntime(await remoteEngine.predictImage(image), 'remote', message);
      }
    }
  };
}

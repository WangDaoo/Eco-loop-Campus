import type { ImagePickerAsset } from 'expo-image-picker';
import type { CreateSubmissionInput } from '../types';

type BuildProofFirstSubmissionInput = {
  binId: string;
  wasteTypeId: string;
  quantity: number;
  proofAsset: Pick<ImagePickerAsset, 'uri' | 'fileName' | 'mimeType'>;
  predictionId?: string;
};

export function buildProofFirstSubmissionInput({
  binId,
  wasteTypeId,
  quantity,
  proofAsset,
  predictionId,
}: BuildProofFirstSubmissionInput): CreateSubmissionInput {
  return {
    binId,
    wasteTypeId,
    quantity,
    predictionId,
    proof: {
      uri: proofAsset.uri,
      name: proofAsset.fileName?.trim() || 'student-proof.jpg',
      mimeType: proofAsset.mimeType?.trim() || 'image/jpeg',
    },
  };
}

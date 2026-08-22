import * as ImagePicker from 'expo-image-picker';

type LibraryPickerOptions = Parameters<typeof ImagePicker.launchImageLibraryAsync>[0];

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function shouldRetryWithLegacyImagePicker(error: unknown) {
  const message = messageOf(error);
  return message.includes('ExponentImagePicker.launchImageLibraryAsync') || message.includes('Failed to parse PhotoPicker result');
}

export async function launchImageLibraryWithFallback(options: LibraryPickerOptions) {
  try {
    return await ImagePicker.launchImageLibraryAsync(options);
  } catch (error) {
    if (!shouldRetryWithLegacyImagePicker(error)) throw error;
    return ImagePicker.launchImageLibraryAsync({ ...options, legacy: true } as LibraryPickerOptions);
  }
}

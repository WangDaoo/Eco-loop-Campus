from pathlib import Path
import h5py
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / 'model' / 'mobilenetv2_model.h5'
OUT_DIR = BASE_DIR.parent / 'ecoloop-campus-mobile' / 'ecoloop-campus-mobile' / 'src' / 'assets' / 'ai'
OUT_DIR.mkdir(parents=True, exist_ok=True)
TFLITE_PATH = OUT_DIR / 'mobilenetv2_waste_float32.tflite'
LABELS_PATH = OUT_DIR / 'labels.txt'

CLASSES = [
    'battery', 'biological', 'cardboard', 'clothes',
    'glass', 'metal', 'paper', 'plastic', 'shoes', 'trash'
]


def load_waste_model(path: Path):
    try:
        return tf.keras.models.load_model(str(path), compile=False)
    except Exception as primary_error:
        try:
            with h5py.File(path, 'r') as model_file:
                model_config = model_file.attrs.get('model_config')
            if model_config is None:
                raise ValueError('model_config missing from H5 file')
            model = tf.keras.models.model_from_json(model_config)
            model.load_weights(str(path))
            return model
        except Exception as fallback_error:
            raise RuntimeError(
                f'load_model failed: {primary_error}; fallback failed: {fallback_error}'
            ) from fallback_error


def main():
    model = load_waste_model(MODEL_PATH)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    TFLITE_PATH.write_bytes(tflite_model)
    LABELS_PATH.write_text('\n'.join(CLASSES) + '\n', encoding='utf-8')
    print(f'Wrote {TFLITE_PATH} ({TFLITE_PATH.stat().st_size} bytes)')
    print(f'Wrote {LABELS_PATH}')


if __name__ == '__main__':
    main()

import unittest

import app


class AppStartupTests(unittest.TestCase):
    def test_model_loads_for_prediction_endpoint(self):
        self.assertIsNotNone(app.model)
        self.assertEqual(app.model.input_shape, (None, 224, 224, 3))
        self.assertEqual(app.model.output_shape[-1], len(app.classes))


if __name__ == "__main__":
    unittest.main()

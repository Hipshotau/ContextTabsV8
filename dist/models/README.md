# Model Files for Context Focus

The Universal Sentence Encoder model files should be placed in this directory.
You can download them from TensorFlow.js model repository.

## Getting the model files

1. Create directories:
   ```
   mkdir -p src/models/universal-sentence-encoder
   ```

2. Download model files:
   ```
   curl -o src/models/universal-sentence-encoder/model.json https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder/1/default/1/model.json
   ```
   
   Note: The model.json file references other binary files that will be downloaded when the model is first loaded.

## Alternative approach

If you prefer not to use external model files, the implementation includes a fallback text classifier that will work without TensorFlow.js models.

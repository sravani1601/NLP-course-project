# Setup Guide for Hugging Face Integration

## Prerequisites

1. **Python 3.8+** installed
2. **Node.js** installed
3. **pip** (Python package manager)

## Installation Steps

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or install manually:
```bash
pip install torch transformers accelerate
```

### 2. Set Up Hugging Face Token (Optional)

If you're using a private model or need authentication:

```bash
# Option 1: Environment variable
export HF_TOKEN=your_token_here

# Option 2: Login via CLI
pip install huggingface_hub
huggingface-cli login
```

### 3. Configure Model

Set the model name in `.env`:

```env
HF_MODEL=google/gemma-2-2b-it
```

Or use your teammate's custom model:
```env
HF_MODEL=your-username/model-name
```

### 4. Test the Integration

```bash
# Test Python script directly
echo '{"goal": "I want to run 3 times a week"}' | python3 src/services/planner_model.py

# Test via API
curl -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"goal": "I want to run 3 times a week early morning"}'
```

## Troubleshooting

### Python Not Found

If you get "Python not found" errors:

1. Check Python installation:
   ```bash
   python3 --version
   ```

2. Update the script path in `chatActionService.js` if needed:
   ```javascript
   const pythonProcess = spawn('python3', [pythonScript], ...);
   // Change 'python3' to 'python' if that's what works on your system
   ```

### Transformers Not Available

If you see "Transformers not available":

1. Install transformers:
   ```bash
   pip install transformers torch
   ```

2. Verify installation:
   ```bash
   python3 -c "import transformers; print(transformers.__version__)"
   ```

### Model Download Issues

If the model fails to download:

1. Check internet connection
2. Verify model name is correct
3. Try downloading manually:
   ```python
   from transformers import AutoTokenizer, AutoModelForCausalLM
   tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-2b-it")
   model = AutoModelForCausalLM.from_pretrained("google/gemma-2-2b-it")
   ```

### Fallback Behavior

The system will automatically fall back to a mock response if:
- Python is not installed
- Transformers library is not available
- Model fails to load
- Model generation fails

Check the server logs for details about what went wrong.

## Using Custom Models

To use your teammate's custom model:

1. Get the model name/ID from Hugging Face
2. Set it in `.env`:
   ```env
   HF_MODEL=your-username/your-model-name
   ```

3. Or pass it in the API request:
   ```json
   {
     "goal": "Your goal here",
     "model_name": "your-username/your-model-name"
   }
   ```

## Performance Notes

- First model load may take time (downloading model weights)
- Subsequent requests will be faster
- Consider using GPU if available (CUDA)
- For production, consider model caching or a dedicated model service


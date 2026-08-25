# 🚀 Ollama GLM-OCR Setup Guide

Complete FREE local OCR solution for invoice processing. No API costs, no cloud dependency.

---

## 📋 Overview

**Ollama GLM-OCR** is integrated into your InvoiceFlow backend:
- ✅ **FREE** - No API costs
- ✅ **LOCAL** - Runs on your machine
- ✅ **PRIVATE** - Data stays local
- ✅ **OFFLINE** - Works without internet
- ✅ **UNLIMITED** - Process as many documents as you want

---

## 🛠️ Installation (5 minutes)

### Step 1: Download Ollama

Visit [ollama.ai](https://ollama.ai) and download for your OS:

**Windows:**
```
Download ollama-windows-amd64.exe
Run the installer
```

**macOS:**
```
Download ollama-darwin-universal.zip
Double-click to extract and install
```

**Linux:**
```bash
curl https://ollama.ai/install.sh | sh
```

### Step 2: Pull GLM Model

After installing Ollama, open terminal/command prompt and run:

```bash
ollama pull glm
```

This downloads the GLM vision model (~2-3GB, one-time download)

**Expected output:**
```
pulling manifest
pulling 5136...
verifying sha256 digest
writing manifest
removing any unused layers
success
```

### Step 3: Start Ollama Server

```bash
ollama serve
```

**Expected output:**
```
time=2026-08-22T... level=INFO msg="Listening on 127.0.0.1:11434"
```

Keep this terminal open - Ollama runs in background on `http://localhost:11434`

### Step 4: Verify Installation

In another terminal, test the connection:

```bash
curl http://localhost:11434/api/tags
```

**Expected response:**
```json
{
  "models": [
    {
      "name": "glm:latest",
      "modified_at": "2026-08-22T...",
      "size": 3000000000,
      "digest": "...",
      "details": {
        "format": "gguf",
        "family": "glm",
        ...
      }
    }
  ]
}
```

---

## ⚙️ Configuration

### Backend .env

Your `.backend/.env` already has Ollama configured:

```env
# OCR Provider - Choose: "ollama" or "gemini"
EXTRACTION_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=glm
OLLAMA_TIMEOUT=60000
```

### To Switch Between Providers

```bash
# Use Ollama (LOCAL - FREE)
EXTRACTION_PROVIDER=ollama

# Use Gemini (CLOUD - COSTS MONEY)
EXTRACTION_PROVIDER=gemini
```

---

## 🚀 Running the Backend

### With Ollama Enabled

```bash
cd backend

# Start backend
npm start

# In another terminal, ensure Ollama is running
ollama serve
```

Both should be running:
```
Backend:  http://localhost:5000
Ollama:   http://localhost:11434
```

### Test the Connection

```bash
# Check extraction provider health
curl http://localhost:5000/api/extraction/health
```

**Expected response (Ollama):**
```json
{
  "success": true,
  "data": {
    "provider": "ollama",
    "healthy": true,
    "message": "Ollama GLM-OCR is ready"
  }
}
```

---

## 📄 Processing Invoices

### Upload and Extract

```bash
# Upload invoice document (automatic Ollama extraction)
curl -X POST http://localhost:5000/api/invoices/upload \
  -F "file=@invoice.pdf" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Backend automatically:
1. ✅ Receives document
2. ✅ Converts to compatible format
3. ✅ Sends to local Ollama
4. ✅ Extracts invoice data
5. ✅ Stores in Firestore
6. ✅ Returns structured data

---

## 🧪 Testing

### Test Endpoint

Extract from test image:

```bash
curl -X POST http://localhost:5000/api/extraction/test \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAA...",
    "mimeType": "image/jpeg"
  }'
```

### Health Check

```bash
curl http://localhost:5000/api/extraction/health
```

### Verify Models

```bash
ollama list
```

Should show:
```
NAME        ID              SIZE    MODIFIED
glm:latest  abc123...       3.0 GB  2 hours ago
```

---

## 🔧 Troubleshooting

### Ollama Connection Failed

**Problem:** "Ollama connection failed"

**Solution:**
```bash
# Verify Ollama is running
ollama serve

# Test connection
curl http://localhost:11434/api/tags

# Check firewall/ports
netstat -an | grep 11434  # Windows
netstat -an | grep 11434  # Mac/Linux
```

### GLM Model Not Found

**Problem:** "GLM model not found"

**Solution:**
```bash
# Download model
ollama pull glm

# Verify it's installed
ollama list

# Should see: glm:latest
```

### Slow Processing

**Problem:** Invoice extraction takes too long (> 60 seconds)

**Solutions:**
1. **Use GPU** - Ollama auto-detects GPU (much faster)
   - NVIDIA: CUDA support
   - AMD: ROCm support
   - Mac: Metal support (automatic)

2. **Reduce timeout** in .env if documents are simpler
   ```env
   OLLAMA_TIMEOUT=30000  # 30 seconds
   ```

3. **Check system resources**
   - RAM needed: ~4GB minimum, 8GB recommended
   - CPU: Modern multi-core processor
   - GPU: Significantly faster (optional but recommended)

### Memory Issues

**Problem:** "Ollama out of memory"

**Solution:**
```bash
# Reduce model precision (smaller memory)
ollama pull glm:7b  # Smaller variant if available

# Or allocate more RAM to Ollama
# Check system memory and free up space
```

---

## 📊 Performance

### Expected Extraction Time

| Document Type | CPU | GPU |
|---|---|---|
| Simple invoice | 10-30s | 2-5s |
| Complex PDF | 30-60s | 5-15s |
| Multi-page | 60-120s | 15-30s |

**Tip:** GPU makes it 5-10x faster!

---

## 🎯 Features Included

### Automatic Invoice Data Extraction
- ✅ Invoice number
- ✅ Invoice date
- ✅ Vendor name
- ✅ GST number
- ✅ PO number
- ✅ Line items (description, quantity, price)
- ✅ Subtotal, tax, total
- ✅ Due date

### Confidence Scores
- Ollama provides confidence levels
- Low confidence items marked as "UNCERTAIN"
- Missing items marked as "MISSING"

### Error Handling
- Automatic retry on timeout
- Graceful fallback to Gemini if configured
- Detailed error messages

---

## 🔄 Ollama Model Options

### GLM (Current - Recommended)
```
ollama pull glm       # Default, good balance
ollama pull glm:7b    # Smaller, faster, less memory
```

### Other Vision Models (Alternative)
```
ollama pull llava     # Good image understanding
ollama pull moondream # Fast image model
```

To switch models, update `.env`:
```env
OLLAMA_MODEL=llava  # Instead of glm
```

---

## 📈 Scaling Up

### For Production Deployment

**Option 1: Docker Container**
```dockerfile
FROM ollama/ollama:latest
RUN ollama pull glm
EXPOSE 11434
CMD ["ollama", "serve"]
```

**Option 2: Ollama Cloud** (Coming soon - official cloud service)

**Option 3: Multiple GPU Servers**
```bash
# Run Ollama on separate GPU machine
OLLAMA_URL=http://gpu-server:11434
```

---

## 💡 Tips & Best Practices

### 1. Keep Ollama Running
```bash
# Run in background (Linux/Mac)
nohup ollama serve > ollama.log &

# Or use screen/tmux
screen -S ollama
ollama serve
# Press Ctrl+A then D to detach
```

### 2. Monitor Resource Usage
```bash
# Check GPU usage
nvidia-smi  # NVIDIA GPUs

# Check memory
top         # All systems
```

### 3. Batch Processing
For multiple documents:
```bash
# Process documents in sequence
# Ollama will queue requests automatically
# Optimal: 1-2 documents at a time
```

### 4. Clear Cache
If extraction is inconsistent:
```bash
# Restart Ollama to clear cache
# Stop ollama serve
# Restart: ollama serve
```

---

## 🔐 Security & Privacy

✅ **All data stays local**
- Documents never leave your machine
- No cloud uploads
- No external API calls for Ollama

✅ **No authentication needed**
- Ollama runs on localhost only
- Not exposed to internet by default
- Firewall protects local network

---

## 📞 Support

### Common Questions

**Q: Can I use Ollama on a Mac?**
A: Yes! Metal support is automatic on Apple Silicon.

**Q: What if I don't have a GPU?**
A: Ollama runs on CPU too, just slower (10-30s per document). GPU is optional.

**Q: Can I use multiple GPU instances?**
A: Yes, set `OLLAMA_URL=http://remote-gpu-server:11434`

**Q: What if Ollama crashes?**
A: Backend automatically falls back to Gemini if configured.

---

## 🎉 You're Ready!

Your InvoiceFlow now has:
- ✅ FREE local OCR
- ✅ No API costs
- ✅ Private data handling
- ✅ Offline capability
- ✅ Fallback to Gemini

Start extracting invoices locally! 🚀


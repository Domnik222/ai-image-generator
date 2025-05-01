import express from 'express';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 30000
});

// Middleware
app.use(express.json({ limit: '5mb' }));

// Static files
const staticPath = path.join(__dirname, 'public');
app.use(express.static(staticPath));

// Rate limiter (20 requests/hour)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

// Load style profiles
const profilesPath = path.join(process.cwd(), 'styleprofiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Multer config for uploads (memory)
const upload = multer({ storage: multer.memoryStorage() });

// Agents 1–4: text-only generation, now using DALL·E 3 via gpt-image-1
app.post('/generate-image', limiter, (req, res) => generateImageWithStyle(req, res, 'style1'));
app.post('/generate-image2', limiter, (req, res) => generateImageWithStyle(req, res, 'style2'));
app.post('/generate-image3', limiter, (req, res) => generateImageWithStyle(req, res, 'style3'));
app.post('/generate-image4', limiter, (req, res) => generateImageWithStyle(req, res, 'style4'));

// Agent5: image‐edit with single upload + auto white mask, using DALL·E 3 via gpt-image-1
app.post('/generate-image5', limiter, upload.single('referenceImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Reference image is required.' });
    }

    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Image description required' });
    }
    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });
    }

    const style = styleProfiles['style5'];
    if (!style) {
      return res.status(400).json({ error: "Style 'style5' not found." });
    }

    console.log('🧪 Upload received:', {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    });

    // 1×1 white PNG mask (base64) → Buffer
    const maskBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQHtC/YAAAAASUVORK5CYII=';
    const maskBuffer = Buffer.from(maskBase64, 'base64');

    const finalPrompt = style.prompt;  // already exactly your final prompt

    console.log('✨ Generating image5 edit with prompt:', finalPrompt);

    const editRes = await openai.images.edit({
      model: 'gpt-image-1',        // ← DALL·E 3 alias
      image: req.file.buffer,
      mask: maskBuffer,
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      response_format: 'url'
    });

    return res.json({
      image_url: editRes.data[0].url,
      revised_prompt: editRes.data[0].revised_prompt,
      upload: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      size,
      quality
    });
  } catch (err) {
    console.error('🔥 Error in /generate-image5:', err);
    const msg = err.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : 'Image generation failed';
    return res.status(err.status || 500).json({ error: msg });
  }
});

// Shared generation handler for agents 1–4
async function generateImageWithStyle(req, res, styleKey) {
  try {
    const { prompt, size = '1024x1024', quality = 'standard', color1, color2, color3 } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000) return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    const style = styleProfiles[styleKey];
    if (!style) return res.status(400).json({ error: `Style '${styleKey}' not found.` });

    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;
    if (styleKey === 'style4') {
      styleGuide += ` Primary colors: ${color1}, ${color2}, ${color3}.`;
    }

    const finalPrompt = `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;
    console.log('🎨 Final prompt:', finalPrompt);

    const genRes = await openai.images.generate({
      model: 'gpt-image-1',       // ← DALL·E 3 alias
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      response_format: 'url',
      style: 'vivid'
    });

    return res.json({
      image_url: genRes.data[0].url,
      revised_prompt: genRes.data[0].revised_prompt,
      size,
      quality
    });
  } catch (err) {
    console.error('🔥 DALL·E Error:', err);
    const msg = err.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : 'Image generation failed';
    return res.status(err.status || 500).json({ error: msg });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DALL·E Image Generator', limits: '20 requests/hour' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('• POST /generate-image');
  console.log('• POST /generate-image2');
  console.log('• POST /generate-image3');
  console.log('• POST /generate-image4');
  console.log('• POST /generate-image5');
});

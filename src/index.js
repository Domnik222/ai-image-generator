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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 30000
});

// JSON body parser
app.use(express.json({ limit: '5mb' }));

// Static files
const staticPath = path.join(__dirname, 'public');
console.log('✅ Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

// Load styles
const profilesPath = path.join(process.cwd(), 'styleprofiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Multer for uploads (memory)
const upload = multer({ storage: multer.memoryStorage() });

// Agents 1–4 (text → generate)
app.post('/generate-image', limiter, (req, res) => generateWithStyle(req, res, 'style1'));
app.post('/generate-image2', limiter, (req, res) => generateWithStyle(req, res, 'style2'));
app.post('/generate-image3', limiter, (req, res) => generateWithStyle(req, res, 'style3'));
app.post('/generate-image4', limiter, (req, res) => generateWithStyle(req, res, 'style4'));

// Agent 5 (image edit with single upload + auto white mask)
app.post(
  '/generate-image5',
  limiter,
  upload.single('referenceImage'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Reference image is required.' });
      }

      const style = styleProfiles['style5'];
      if (!style) {
        return res.status(400).json({ error: `Style 'style5' not found.` });
      }

      // Log upload metadata
      console.log('🧪 Upload received:', {
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size
      });

      // Build the final prompt exactly as defined in style5
      const finalPrompt = style.prompt;

      // Create a 1×1 white mask PNG (base64 → buffer)
      const maskBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQHtC/YAAAAASUVORK5CYII=';
      const maskBuffer = Buffer.from(maskBase64, 'base64');

      console.log('✨ Generating image5 edit with prompt:', finalPrompt);

      const editRes = await openai.images.edit({
        model: 'gpt-image-1',      // DALL·E 3 alias
        image: req.file.buffer,
        mask: maskBuffer,
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024'
      });

      return res.json({
        image_url: editRes.data[0].url,
        revised_prompt: editRes.data[0].revised_prompt
      });
    } catch (err) {
      console.error('🔥 Error in /generate-image5:', err);
      const msg = err.message.includes('content policy')
        ? 'Prompt rejected: violates content policy'
        : 'Image edit failed';
      return res.status(err.status || 500).json({ error: msg });
    }
  }
);

async function generateWithStyle(req, res, styleKey) {
  try {
    const {
      prompt,
      size = '1024x1024',
      quality = 'standard',
      color1,
      color2,
      color3
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Image description required' });
    }
    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });
    }

    const style = styleProfiles[styleKey];
    if (!style) {
      return res.status(400).json({ error: `Style '${styleKey}' not found.` });
    }

    console.log(`Using style: ${style.name}`);
    console.log('User prompt:', prompt);

    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;
    if (styleKey === 'style4') {
      styleGuide += ` Primary colors: ${color1}, ${color2}, ${color3}.`;
    }

    const finalPrompt = `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;

    console.log('🎨 Final prompt:', finalPrompt);

    const genRes = await openai.images.generate({
      model: 'gpt-image-1',    // DALL·E 3 alias
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      style: 'vivid'
    });

    return res.json({
      image_url: genRes.data[0].url,
      revised_prompt: genRes.data[0].revised_prompt
    });
  } catch (err) {
    console.error(`🔥 Error in generateWithStyle [${styleKey}]:`, err);
    const msg = err.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : 'Image generation failed';
    return res.status(err.status || 500).json({ error: msg });
  }
}

// Health check
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'DALL·E Image Generator', limits: '20 requests/hour' })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('• POST /generate-image');
  console.log('• POST /generate-image2');
  console.log('• POST /generate-image3');
  console.log('• POST /generate-image4');
  console.log('• POST /generate-image5');
});

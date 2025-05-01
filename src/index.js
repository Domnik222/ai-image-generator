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

app.use(express.json({ limit: '5mb' }));

const staticPath = path.join(__dirname, 'public');
console.log('✅ Serving static files from:', staticPath);
app.use(express.static(staticPath));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

const profilesPath = path.join(process.cwd(), 'styleprofiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Endpoints
app.post('/generate-image', limiter, async (req, res) => {
  await generateImageWithStyle(req, res, 'style1');
});
app.post('/generate-image2', limiter, async (req, res) => {
  await generateImageWithStyle(req, res, 'style2');
});
app.post('/generate-image3', limiter, async (req, res) => {
  await generateImageWithStyle(req, res, 'style3');
});
app.post('/generate-image4', limiter, async (req, res) => {
  await generateImageWithStyle(req, res, 'style4');
});
app.post('/generate-image5', limiter, upload.single('image'), async (req, res) => {
  await generateImageWithReference(req, res, 'style5');
});

async function generateImageWithStyle(req, res, styleKey) {
  try {
    const { prompt, size = '1024x1024', quality = 'standard', color1, color2, color3 } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000) return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    const style = styleProfiles[styleKey];
    if (!style) return res.status(400).json({ error: `Style '${styleKey}' not found.` });

    console.log(`Using style: ${style.name}`);
    console.log('User prompt:', prompt);

    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;
    if (styleKey === 'style4') {
      styleGuide += ` Primary colors: ${color1 || 'N/A'}, ${color2 || 'N/A'}, ${color3 || 'N/A'}.`;
    }

    let finalPrompt = `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;
    if (styleKey === 'style4') {
      finalPrompt += ` Use primary shapes in these colors: ${color1 || 'N/A'}, ${color2 || 'N/A'}, ${color3 || 'N/A'}.`;
    }

    console.log('🎨 Final prompt:', finalPrompt);

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      style: 'vivid'
    });

    return res.json({
      image_url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt,
      size,
      quality
    });
  } catch (error) {
    console.error('🔥 DALL·E Error:', error);
    const errorMessage = error.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : error.message.includes('billing')
      ? 'API billing issue'
      : 'Image generation failed';

    return res.status(error.status || 500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function generateImageWithReference(req, res, styleKey) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Reference image file required' });

    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000) return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    const style = styleProfiles[styleKey] || { name: 'Glassy Objects', description: '3D translucent glass objects with frosty matte finish and natural lighting.' };

    console.log(`🧪 Upload received:`, req.file);
    console.log(`✨ Generating ${styleKey} edit with prompt:`, prompt);

    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;
    const finalPrompt = `A soft, 3D translucent glass of the attached image with a frosty matte finish and detailed texture, original colors, centered on a light gray background, floats gently in space, soft shadows, natural lighting. ${prompt}`;

    const response = await openai.images.edit({
      model: 'gpt-image-1', // must use gpt-image-1 for edits
      image: req.file.buffer,
      prompt: finalPrompt,
      n: 1,
      size
    });

    return res.json({
      image_url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt,
      size,
      quality
    });
  } catch (error) {
    console.error(`🔥 Error in /${styleKey}:`, error);
    const errorMessage = error.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : error.message.includes('billing')
      ? 'API billing issue'
      : 'Image edit failed';

    return res.status(error.status || 500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DALL·E Image Generator',
    limits: '20 requests/hour'
  });
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

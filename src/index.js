import express from 'express';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // For Render or proxies

// Fix __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Init OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 30000
});

// Middleware
app.use(express.json({ limit: '5mb' }));

// Static files
const staticPath = path.join(__dirname, 'public');
console.log('✅ Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Rate limiters (20 requests/hour)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

// Load styles JSON
const profilesPath = path.join(process.cwd(), 'styleprofiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Image generation for Agent 1
app.post('/generate-image', limiter, async (req, res) => {
  await generateImageWithStyle(req, res, 'style1');
});

// Image generation for Agent 2
app.post('/generate-image2', limiter, async (req, res) => {
  await generateImageWithStyle(req, res, 'style2');
});

// Image generation logic
async function generateImageWithStyle(req, res, styleKey) {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000) return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    const style = styleProfiles[styleKey];
    if (!style) return res.status(400).json({ error: `Style '${styleKey}' not found.` });

    const styleGuide = `Style Profile: ${style.name}. Description: ${style.description}. Design Directives: ${Object.entries(style.designDirectives)
      .map(([k, v]) => `${k}: ${v}`).join(', ')}. Visual Characteristics: ${Object.entries(style.visualCharacteristics)
      .map(([k, v]) => `${k}: ${v}`).join(', ')}.`;

    const finalPrompt = `Professional digital artwork, 4K resolution. ${styleGuide} Please create an image that depicts: ${prompt}`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      response_format: 'url',
      style: 'vivid'
    });

    res.json({
      image_url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt,
      size,
      quality
    });

  } catch (error) {
    console.error('🔥 DALL·E Error:', error.message);
    const errorMessage = error.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : error.message.includes('billing')
        ? 'API billing issue'
        : 'Image generation failed';

    res.status(error.status || 500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DALL·E Image Generator', limits: '20 requests/hour' });
});

// Dynamic port
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`• POST /generate-image`);
  console.log(`• POST /generate-image2`);
});

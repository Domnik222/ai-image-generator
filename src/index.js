import express from 'express';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // For proxies

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

// Rate limiter (20 requests/hour)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

// Load styles JSON
const profilesPath = path.join(process.cwd(), 'styleprofiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Endpoints for the agents
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

// Core image generation logic
async function generateImageWithStyle(req, res, styleKey) {
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

    // Build styleGuide string
    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;

    // Append color info for style4
    if (styleKey === 'style4') {
      styleGuide += ` Primary colors: ${color1 || 'N/A'}, ${color2 || 'N/A'}, ${color3 || 'N/A'}.`;
    }

    // Construct final prompt
    let finalPrompt =
      `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;

    if (styleKey === 'style4') {
      finalPrompt +=
        ` Use primary shapes in these colors: ${color1 || 'N/A'}, ${color2 || 'N/A'}, ${color3 || 'N/A'}.`;
    }

    console.log('🎨 Final prompt:', finalPrompt);

    // Call DALL·E
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      response_format: 'url',
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DALL·E Image Generator',
    limits: '20 requests/hour'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('• POST /generate-image');
  console.log('• POST /generate-image2');
  console.log('• POST /generate-image3');
  console.log('• POST /generate-image4');
});

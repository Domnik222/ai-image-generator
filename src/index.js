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

// Image generation logic with conditional style guide formatting
async function generateImageWithStyle(req, res, styleKey) {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt)
      return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000)
      return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    console.log("🧠 styleProfiles:", styleProfiles);
    const style = styleProfiles[styleKey];
    if (!style) {
      console.error(`Style '${styleKey}' not found in JSON.`);
      return res.status(400).json({ error: `Style '${styleKey}' not found.` });
    }

    console.log(`Using style: ${style.name}`);
    console.log("User prompt:", prompt);

    let styleGuide = '';
    if (styleKey === 'style2') {
      // Build style guide for style2 using "visual_elements"
      styleGuide = `Style Profile: ${style.name}. ${style.description}. Visual Elements: ${Object.entries(style.visual_elements)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: ${value.join(', ')}`;
          } else if (typeof value === 'object') {
            return `${key}: ${Object.entries(value)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')}`;
          } else {
            return `${key}: ${value}`;
          }
        })
        .join(', ')}`;
    } else if (styleKey === 'style3') {
      // Build style guide for style3 using alternative keys (e.g., "aesthetic" and "colorScheme")
      // Update the keys below to match your "style3" schema in your styleprofiles.json.
      styleGuide = `Style Profile: ${style.name}. ${style.description}. Aesthetic: ${style.aesthetic ? style.aesthetic : 'Not specified'}. Color Scheme: ${style.colorScheme ? (Array.isArray(style.colorScheme) ? style.colorScheme.join(', ') : style.colorScheme) : 'Standard'}.`;
    } else {
      // Default style guide (for style1)
      styleGuide = `Style Profile: ${style.name}. Description: ${style.description}. Design Directives: ${Object.entries(style.designDirectives)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}. Visual Characteristics: ${Object.entries(style.visualCharacteristics)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}.`;
    }

    const finalPrompt = `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;
    console.log("🎨 Final prompt:", finalPrompt);

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
    console.error('🔥 DALL·E Error:', error);
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
  res.json({
    status: 'ok',
    service: 'DALL·E Image Generator',
    limits: '20 requests/hour'
  });
});

// Dynamic port
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`• POST /generate-image`);
  console.log(`• POST /generate-image2`);
  console.log(`• POST /generate-image3`);
});

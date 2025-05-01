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

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OpenAI init
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 30000
});

// Multer (in‐memory) for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// JSON body parser
app.use(express.json({ limit: '5mb' }));

// Serve static
const staticPath = path.join(__dirname, 'public');
app.use(express.static(staticPath));

// Rate limiter (20/hr)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

// Load style profiles
const profilesPath = path.join(process.cwd(), 'styleprofiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Existing style routes...
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

// NEW: Glassy Objects (style5)
app.post(
  '/generate-image5',
  limiter,
  upload.single('referenceImage'),
  async (req, res) => {
    try {
      const styleKey = 'style5';
      const style = styleProfiles[styleKey];
      if (!style) {
        return res.status(400).json({ error: `Style '${styleKey}' not found.` });
      }

      // Use the fixed prompt from your JSON
      let finalPrompt = `Professional. Style Profile: ${style.name}. ${style.prompt}`;

      console.log('🧊 Reference image bytes:', req.file?.size || 'none');
      console.log('🎨 Final prompt for style5:', finalPrompt);

      // NOTE: DALL·E Images API doesn’t yet support direct image‐to‐image
      // in the generate() call, so if you’re doing true editing you’d swap
      // to openai.images.edit() here.  For now we just feed the text prompt.
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
        style: 'vivid'
      });

      return res.json({
        image_url: response.data[0].url,
        revised_prompt: response.data[0].revised_prompt
      });
    } catch (error) {
      console.error('🔥 style5 Error:', error);
      const msg = error.message.includes('content policy')
        ? 'Prompt rejected: violates content policy'
        : 'Image generation failed';
      return res
        .status(error.status || 500)
        .json({ error: msg, details: error.message });
    }
  }
);

// Shared handler for styles 1–4
async function generateImageWithStyle(req, res, styleKey) {
  try {
    const { prompt, size = '1024x1024', quality = 'standard', color1, color2, color3 } =
      req.body;

    if (!prompt) return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000)
      return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    const style = styleProfiles[styleKey];
    if (!style) return res.status(400).json({ error: `Style '${styleKey}' not found.` });

    // Build style guide
    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;
    if (styleKey === 'style4') {
      styleGuide += ` Primary colors: ${color1 || 'N/A'}, ${color2 || 'N/A'}, ${color3 || 'N/A'}.`;
    }

    let finalPrompt = `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;
    if (styleKey === 'style4') {
      finalPrompt += ` Use primary shapes in these colors: ${color1}, ${color2}, ${color3}.`;
    }

    console.log('🎨 Final prompt:', finalPrompt);

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
    const errMsg = error.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : 'Image generation failed';
    return res
      .status(error.status || 500)
      .json({ error: errMsg, details: error.message });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'DALL·E Image Generator', limits: '20 requests/hour' });
});

// Start
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('• POST /generate-image');
  console.log('• POST /generate-image2');
  console.log('• POST /generate-image3');
  console.log('• POST /generate-image4');
  console.log('• POST /generate-image5');  // new
});

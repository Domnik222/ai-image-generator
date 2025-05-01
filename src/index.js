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
console.log('✅ Serving static files from:', staticPath);
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

// Multer config for uploads
const upload = multer({ storage: multer.memoryStorage() });

// Existing style endpoints
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

// NEW: Agent5 - single upload + auto white mask
app.post('/generate-image5', limiter, upload.single('referenceImage'), async (req, res) => {
  try {
    console.log('🧪 Upload received:', {
      name: req.file?.originalname,
      type: req.file?.mimetype,
      size: req.file?.size
    });

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

    // 1x1 white PNG mask in Base64
    const maskBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQHtC/YAAAAASUVORK5CYII=';
    const maskBuffer = Buffer.from(maskBase64, 'base64');

    // Final prompt
    const finalPrompt =
      "3D render of a translucent glass object with a frosty matte finish, " +
      "detailed texture, in its original colors, poised gently in mid-air. " +
      "The object is depicted with soft shadows and natural light reflecting on it, " +
      "contributing to its overall polished aesthetic. All of this is set against " +
      "a well-balanced light gray background to enhance the object's luminosity.";

    console.log('✨ Generating image5 edit with prompt:', finalPrompt);

    const response = await openai.images.edit({
      model: 'dall-e-3',
      image: req.file.buffer,
      mask: maskBuffer,
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      response_format: 'url'
    });

    return res.json({
      image_url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt,
      upload: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      size,
      quality
    });
  } catch (error) {
    console.error('🔥 Error in /generate-image5:', error);
    const msg = error.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : 'Image generation failed';
    return res.status(error.status || 500).json({ error: msg });
  }
});

// Shared handler for agents 1-4
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

    let styleGuide = `Style Profile: ${style.name}. ${style.description}.`;
    if (styleKey === 'style4') {
      styleGuide += ` Primary colors: ${color1 || 'N/A'}, ${color2 || 'N/A'}, ${color3 || 'N/A'}.`;
    }

    let finalPrompt =
      `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;
    if (styleKey === 'style4') {
      finalPrompt += ` Use primary shapes in these colors: ${color1}, ${color2}, ${color3}.`;
    }

    console.log('🎨 Final prompt:', finalPrompt);

    const imgRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
      response_format: 'url',
      style: 'vivid'
    });

    return res.json({
      image_url: imgRes.data[0].url,
      revised_prompt: imgRes.data[0].revised_prompt,
      size,
      quality
    });
  } catch (err) {
    console.error('🔥 DALL·E Error:', err);
    const errorMessage = err.message.includes('content policy')
      ? 'Prompt rejected: violates content policy'
      : err.message.includes('billing')
      ? 'API billing issue'
      : 'Image generation failed';

    return res.status(err.status || 500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
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
  console.log('• POST /generate-image5');
});

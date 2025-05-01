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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 30000
});

// JSON body parser
app.use(express.json({ limit: '5mb' }));

// Serve static files
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

// Multer disk storage for uploads, preserving extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Endpoints for styles 1-4
app.post('/generate-image', limiter, (req, res) => generateWithStyle(req, res, 'style1'));
app.post('/generate-image2', limiter, (req, res) => generateWithStyle(req, res, 'style2'));
app.post('/generate-image3', limiter, (req, res) => generateWithStyle(req, res, 'style3'));
app.post('/generate-image4', limiter, (req, res) => generateWithStyle(req, res, 'style4'));

// Endpoint for style5: single upload + auto white mask
app.post(
  '/generate-image5',
  limiter,
  upload.single('referenceImage'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Reference image required.' });
      }

      const style = styleProfiles['style5'];
      if (!style) {
        return res.status(400).json({ error: `Style 'style5' not found.` });
      }

      console.log('🧪 Upload received:', {
        name: req.file.originalname,
        path: req.file.path,
        size: req.file.size
      });
      console.log('✨ Prompt:', style.prompt);

      // Write out white mask PNG
      const maskBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQHtC/YAAAAASUVORK5CYII=';
      const maskPath = path.join(uploadsDir, `mask-${Date.now()}.png`);
      fs.writeFileSync(maskPath, Buffer.from(maskBase64, 'base64'));

      // Create streams for image and mask
      const imageStream = fs.createReadStream(req.file.path);
      const maskStream = fs.createReadStream(maskPath);

      const editRes = await openai.images.edit({
        model: 'gpt-image-1',
        image: imageStream,
        mask: maskStream,
        prompt: style.prompt,
        n: 1,
        size: '1024x1024'
      });

      // Cleanup temp files
      fs.unlinkSync(req.file.path);
      fs.unlinkSync(maskPath);

      return res.json({
        image_url: editRes.data[0].url,
        revised_prompt: editRes.data[0].revised_prompt
      });
    } catch (err) {
      console.error('🔥 Error in /generate-image5:', err);
      return res.status(err.status || 500).json({ error: 'Image edit failed' });
    }
  }
);

// Shared generation handler for styles 1-4
async function generateWithStyle(req, res, styleKey) {
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
      styleGuide += ` Primary colors: ${color1}, ${color2}, ${color3}.`;
    }

    const finalPrompt = `Professional. ${styleGuide} Please create an image that depicts: ${prompt}`;
    console.log('🎨 Final prompt:', finalPrompt);

    const genRes = await openai.images.generate({
      model: 'gpt-image-1',
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
    return res.status(err.status || 500).json({ error: 'Image generation failed' });
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

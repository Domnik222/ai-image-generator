import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: 20000
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Rate limiter (20 requests/hour)
const imageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many image generation requests. Limit: 20/hour.',
  headers: true
});

app.use('/generate-image', imageLimiter);

// Load style profiles from external JSON file
const profilesPath = path.join(process.cwd(), 'styleProfiles.json');
const styleProfiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));

// Your existing endpoint using the loaded JSON
app.post('/generate-image', async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard' } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Image description required' });
    if (prompt.length > 1000) return res.status(400).json({ error: 'Prompt too long (max 1000 chars)' });

    // Select the desired style profile (hard-coded "style1" for now)
    const style = styleProfiles.style1;
    const styleGuide = `Style Profile: ${style.name}. Description: ${style.description}. Design Directives: ${Object.entries(style.designDirectives)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}. Visual Characteristics: ${Object.entries(style.visualCharacteristics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}.`;

    const finalPrompt = `Professional digital artwork, 4K resolution. ${styleGuide} Please create an image that depicts: ${prompt}`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: size,
      quality: quality,
      response_format: "url",
      style: "vivid"
    });

    res.json({
      image_url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt,
      size: size,
      quality: quality
    });
    
  } catch (error) {
    console.error('DALL-E Error:', error);
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
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DALL-E Image Generator',
    limits: '20 requests/hour'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🖼️ Image server running on port ${PORT}`);
  console.log(`• Endpoint: POST http://localhost:${PORT}/generate-image`);
});

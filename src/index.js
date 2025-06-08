import express from 'express';
import cors from 'cors';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Set up multer for image upload
const upload = multer({ storage: multer.memoryStorage() });

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('src/public')));

function validatePrompt(prompt, res) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    res.status(400).json({ error: 'Prompt is required and must be a non-empty string.' });
    return false;
  }
  return true;
}

// Agent 5: With optional image upload and resolution
app.post('/generate-image5', upload.single('image'), async (req, res) => {
  const prompt = req.body.prompt;
  const size = req.body.size || '1024x1024';

  if (!validatePrompt(prompt, res)) return;

  try {
    const messages = [
      { role: 'system', content: 'Refine the user prompt for image generation.' },
      { role: 'user', content: prompt }
    ];

    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });

    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    // Log final prompt
    console.log('Final prompt (Agent 5):', revised_prompt);

    const imageOptions = {
      model: 'dall-e-3',
      prompt: revised_prompt,
      size,
      n: 1,
    };

    const genResult = await openai.images.generate(imageOptions);

    res.json({
      image_url: genResult.data[0].url,
      revised_prompt
    });
  } catch (err) {
    console.error('Error in /generate-image5:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

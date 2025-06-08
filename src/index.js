import express from 'express';
import cors from 'cors';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Validate prompt
function validatePrompt(prompt, res) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    res.status(400).json({ error: 'Prompt is required and must be a non-empty string.' });
    return false;
  }
  return true;
}

// Agent 3: Glassy Icons
app.post('/generate-image3', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024', // fixed invalid size
      n: 1,
    });
    res.json({
      image_url: result.data[0].url,
      revised_prompt: prompt,
    });
  } catch (err) {
    console.error('Error in /generate-image3:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 5: Prompt-based Generation
app.post('/generate-image5', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the user prompt for image generation.' },
        { role: 'user', content: prompt },
      ],
    });
    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    const genResult = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({
      image_url: genResult.data[0].url,
      revised_prompt,
    });
  } catch (err) {
    console.error('Error in /generate-image5:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 6: Glassy Objects
app.post('/generate-image6', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the user prompt for glassy object generation.' },
        { role: 'user', content: prompt },
      ],
    });
    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    const genResult = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({
      image_url: genResult.data[0].url,
      revised_prompt,
    });
  } catch (err) {
    console.error('Error in /generate-image6:', err);
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

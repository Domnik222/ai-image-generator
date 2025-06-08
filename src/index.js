import express from 'express';
import cors from 'cors';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Helper: Validate prompt
function validatePrompt(prompt, res) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    res.status(400).json({ error: 'Prompt is required and must be a meaningful string.' });
    return false;
  }
  return true;
}

// Agent 1 – Geometric Logos (raw prompt)
app.post('/generate-image1', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({
      image_url: result.data[0].url,
      revised_prompt: prompt,
    });
  } catch (err) {
    console.error('Error in /generate-image1:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 2 – Minimalist 3D (with prompt refinement)
app.post('/generate-image2', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the user prompt for a minimalist 3D illustration with soft lighting.' },
        { role: 'user', content: prompt },
      ],
    });

    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({ image_url: result.data[0].url, revised_prompt });
  } catch (err) {
    console.error('Error in /generate-image2:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 3 – Patent Blueprint (raw prompt)
app.post('/generate-image3', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x768',
      n: 1,
    });

    res.json({ image_url: result.data[0].url, revised_prompt: prompt });
  } catch (err) {
    console.error('Error in /generate-image3:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 4 – Bauhaus Design (refined)
app.post('/generate-image4', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the prompt for a minimalist Bauhaus design sheet using bold shapes and primary colors.' },
        { role: 'user', content: prompt },
      ],
    });

    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({ image_url: result.data[0].url, revised_prompt });
  } catch (err) {
    console.error('Error in /generate-image4:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 5 – Frosted Glass Render (refined)
app.post('/generate-image5', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the prompt to create a frosted translucent glass render.' },
        { role: 'user', content: prompt },
      ],
    });

    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({ image_url: result.data[0].url, revised_prompt });
  } catch (err) {
    console.error('Error in /generate-image5:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 6 – Iridescent Glass Render (refined)
app.post('/generate-image6', async (req, res) => {
  const { prompt } = req.body;
  if (!validatePrompt(prompt, res)) return;

  try {
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the prompt for a photorealistic iridescent glass render with bloom and dispersion effects.' },
        { role: 'user', content: prompt },
      ],
    });

    const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      size: '1024x1024',
      n: 1,
    });

    res.json({ image_url: result.data[0].url, revised_prompt });
  } catch (err) {
    console.error('Error in /generate-image6:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

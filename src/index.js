import express from 'express';
import cors from 'cors';
import path from 'path';
import { OpenAI } from 'openai';

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Agent 3: Glassy Icons (generate-image3)
app.post('/generate-image3', async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '512x512',
      n: 1,
    });
    res.json({
      image_url: result.data[0].url,
      revised_prompt: prompt, // no refinement
    });
  } catch (err) {
    console.error('Error in /generate-image3:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 5: Prompt-based Generation (generate-image5)
app.post('/generate-image5', async (req, res) => {
  try {
    const { prompt } = req.body;
    // Optionally refine prompt
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the user prompt for image generation.' },
        { role: 'user', content: prompt },
      ],
    });
    const revised_prompt = refined.choices[0].message.content;

    const genResult = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      n: 1,
      size: '1024x1024',
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

// Agent 6: Glassy Objects (generate-image6)
app.post('/generate-image6', async (req, res) => {
  try {
    const { prompt } = req.body;
    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the user prompt for glassy object generation.' },
        { role: 'user', content: prompt },
      ],
    });
    const revised_prompt = refined.choices[0].message.content;

    const genResult = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revised_prompt,
      n: 1,
      size: '1024x1024',
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

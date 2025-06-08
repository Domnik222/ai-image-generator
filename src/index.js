import express from 'express';
import cors from 'cors';
import path from 'path';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const upload = multer({ storage: multer.memoryStorage() });

// Load style profiles
const styleProfiles = JSON.parse(fs.readFileSync(path.resolve('styleprofiles.json'), 'utf-8'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Agent 5: Prompt-based Generation with style5 injection
app.post('/generate-image5', upload.single('image'), async (req, res) => {
  const userPrompt = req.body.prompt;
  const size = req.body.size || '1024x1024';

  if (!validatePrompt(userPrompt, res)) return;

  try {
    const stylePrompt = styleProfiles.style5?.prompt || '';
    const combinedPrompt = `${stylePrompt} ${userPrompt}`;

    console.log("Agent 5 Final Prompt:", combinedPrompt);

    const refined = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Refine the following prompt for 3D glass render image generation.' },
        { role: 'user', content: combinedPrompt },
      ],
    });

    const revisedPrompt = refined.choices?.[0]?.message?.content || combinedPrompt;

    const genResult = await openai.images.generate({
      model: 'dall-e-3',
      prompt: revisedPrompt,
      size,
      n: 1,
    });

    res.json({ image_url: genResult.data[0].url, revised_prompt: revisedPrompt });
  } catch (err) {
    console.error('Error in /generate-image5:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

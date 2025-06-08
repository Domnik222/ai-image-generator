import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Load styles from stylesprofiles.json
const styleProfiles = JSON.parse(fs.readFileSync(path.resolve('styleprofiles.json'), 'utf-8'));

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Validate prompt
function validatePrompt(prompt, res) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    res.status(400).json({ error: 'Prompt must be a meaningful non-empty string.' });
    return false;
  }
  return true;
}

// Helper to get description from styleProfiles
function getStylePrompt(styleKey) {
  return styleProfiles[styleKey]?.description || 'Refine the prompt for creative AI image generation.';
}

// Route generator
function createAgentRoute(agentNumber, imageSize = '1024x1024') {
  app.post(`/generate-image${agentNumber}`, async (req, res) => {
    const { prompt } = req.body;
    if (!validatePrompt(prompt, res)) return;

    try {
      const styleKey = `style${agentNumber}`;
      const systemMessage = getStylePrompt(styleKey);

      const refined = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
      });

      const revised_prompt = refined.choices?.[0]?.message?.content || prompt;

      const result = await openai.images.generate({
        model: 'dall-e-3',
        prompt: revised_prompt,
        size: imageSize,
        n: 1,
      });

      res.json({ image_url: result.data[0].url, revised_prompt });
    } catch (err) {
      console.error(`Error in /generate-image${agentNumber}:`, err);
      res.status(500).json({ error: err.message });
    }
  });
}

// Create routes for agents 1–6
createAgentRoute(1);
createAgentRoute(2);
createAgentRoute(3, '1024x768'); // Blueprint style
createAgentRoute(4);
createAgentRoute(5);
createAgentRoute(6);

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { OpenAI } from 'openai';

// Initialize Express app
tconst app = express();
const port = process.env.PORT || 3001;

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('src/public')));

// Multer setup for file uploads
const upload = multer({ dest: 'src/uploads/' });

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
      revised_prompt: result.usage.prompt, // or other field if using prompt refinement
    });
  } catch (err) {
    console.error('Error in /generate-image3:', err);
    res.status(500).json({ error: err.message });
  }
});

// Agent 5: Image Editing (generate-image5)
app.post('/generate-image5', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(fileExt)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const editResult = await openai.images.edit({
      model: 'dall-e-2',
      image: {
        data: fileBuffer,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      },
      prompt: 'A soft, 3D translucent glass of the attached image with a frosty matte finish and detailed texture, original colors, centered on a light gray background, floats gently in space, soft shadows, natural lighting',
      n: 1,
      size: '1024x1024',
    });

    fs.unlinkSync(filePath);
    res.json(editResult);
  } catch (error) {
    console.error('Error in /generate-image5:', error);
    res.status(500).json({ error: error.message || 'Image editing failed' });
  }
});

// Agent 6: Glassy Objects (generate-image6)
app.post('/generate-image6', async (req, res) => {
  try {
    const { prompt } = req.body;
    // Optionally refine prompt here using OpenAI completions
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

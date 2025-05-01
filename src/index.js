import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { OpenAI } from 'openai';

const app = express();
const port = 3001;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({ dest: 'src/uploads/' });

app.use(express.static('src/public'));

app.post('/generate-image5', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(fileExt)) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const result = await openai.images.edit({
      model: 'dall-e-2',  // ✅ FIXED model
      image: {
        data: fileBuffer,
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      },
      prompt: 'A soft, 3D translucent glass of the attached image with a frosty matte finish and detailed texture, original colors, centered on a light gray background, floats gently in space, soft shadows, natural lighting',
      n: 1,
      size: '1024x1024',
    });

    fs.unlinkSync(filePath); // cleanup uploaded file

    res.json(result);
  } catch (error) {
    console.error('🔥 Error in /generate-image5:', error);
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});

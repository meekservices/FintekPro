import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({});

async function analyzeImage() {
  try {
    const imagePath = '/Users/sangrammohanty/.gemini/antigravity-ide/brain/5d735f9a-3b7a-49a3-aa6e-dd554551f7cd/media__1779623243600.png';
    const imagePart = {
      inlineData: {
        data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
        mimeType: "image/png"
      }
    };
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        imagePart,
        "What does the error text say in this image? Provide a detailed description of the error."
      ]
    });
    console.log(response.text);
  } catch (error) {
    console.error(error);
  }
}

analyzeImage();

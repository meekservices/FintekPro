import { GoogleGenAI } from "@google/genai";

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY || "AIzaSyByjUDDhPauYO15N0LlkFl-0k2zY53YZNQ";
  console.log("Testing API Key:", apiKey.substring(0, 10) + "...");
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: "Hello, are you working?" }] }],
    });
    console.log("SUCCESS:", response.text);
  } catch (error) {
    console.error("FAILURE:", error.message);
    if (error.response) {
      console.error("DETAILS:", JSON.stringify(error.response, null, 2));
    }
  }
}

testGemini();

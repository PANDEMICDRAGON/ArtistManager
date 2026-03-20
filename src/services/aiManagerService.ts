import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AIStrategy {
  summary: string;
  arFeedback: string;
  prPlan: string;
  businessAdvice: string;
  suggestedTasks: { title: string; description: string; category: string }[];
}

export const generateAIStrategy = async (projectData: any): Promise<AIStrategy> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an elite Artist Manager, A&R expert, and PR specialist for the music industry.
    Analyze the following project data and provide a comprehensive management strategy.
    
    Project Data:
    ${JSON.stringify(projectData, null, 2)}
    
    Provide your response in the following JSON format:
    {
      "summary": "High-level overview of the project's current state and potential.",
      "arFeedback": "Specific feedback on the creative direction, song titles, and market fit.",
      "prPlan": "A concise PR and marketing strategy including key milestones.",
      "businessAdvice": "Strategic advice on distribution, legal/metadata readiness, and career growth.",
      "suggestedTasks": [
        { "title": "Task Title", "description": "Detailed description", "category": "A&R|PR|Business|Legal" }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          arFeedback: { type: Type.STRING },
          prPlan: { type: Type.STRING },
          businessAdvice: { type: Type.STRING },
          suggestedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: { type: Type.STRING }
              },
              required: ["title", "description", "category"]
            }
          }
        },
        required: ["summary", "arFeedback", "prPlan", "businessAdvice", "suggestedTasks"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const chatWithManager = async (message: string, context: any) => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an elite Artist Manager. You are currently managing a project with the following context:
    ${JSON.stringify(context, null, 2)}
    
    The artist/label is asking: "${message}"
    
    Respond as a professional, proactive, and insightful manager. Keep it concise but high-impact.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

export const generatePostContent = async (platform: string, project: any, tone: string = 'hype') => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Generate a high-impact social media post for ${platform}.
    Project: ${project.name} by ${project.artistName}
    Tone: ${tone}
    
    Include relevant hashtags and emojis. Keep it optimized for ${platform}'s audience.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

export const analyzeMusicMetadata = async (asset: any, project: any) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze the following music asset metadata for the project "${project.name}".
    Asset: ${JSON.stringify(asset, null, 2)}
    
    Provide a professional A&R analysis of the track's potential, suggested target audience, and any technical improvements needed based on the metadata provided.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

export const analyzeMarketTrends = async (genre: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Analyze current market trends for the ${genre} music genre as of March 2026.
    Focus on:
    1. Emerging sub-genres or sounds.
    2. Viral marketing tactics currently working on TikTok/Reels.
    3. Successful release strategies for independent artists in this space.
    
    Provide actionable insights for an artist manager.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

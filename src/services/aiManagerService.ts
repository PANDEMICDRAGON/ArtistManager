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

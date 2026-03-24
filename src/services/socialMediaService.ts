import { GoogleGenAI } from "@google/genai";

export interface SocialMediaStats {
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube' | 'facebook';
  followers: number;
  engagementRate?: number;
  handle: string;
  url: string;
}

export interface ArtistSocialData {
  artistName: string;
  stats: SocialMediaStats[];
  lastUpdated: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const fetchArtistSocials = async (artistName: string): Promise<ArtistSocialData> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for and pull the ACTUAL current social media follower counts, handles, and estimated engagement metrics (like engagement rate percentage) for the musical artist "${artistName}". 
      Focus on Instagram, TikTok, Twitter (X), and YouTube.
      Return ONLY a JSON object matching this structure:
      {
        "artistName": string,
        "stats": [
          {
            "platform": "instagram" | "tiktok" | "twitter" | "youtube",
            "followers": number,
            "engagementRate": number (e.g., 2.5 for 2.5%),
            "handle": string,
            "url": string
          }
        ]
      }
      If you cannot find exact numbers, provide the most recent estimates found.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text || '{}');
    return {
      artistName: data.artistName || artistName,
      stats: data.stats || [],
      lastUpdated: new Error().stack?.includes('fetchArtistSocials') ? new Date().toISOString() : new Date().toISOString()
    };
  } catch (error) {
    console.error("Failed to fetch social media data", error);
    return {
      artistName,
      stats: [],
      lastUpdated: new Date().toISOString()
    };
  }
};

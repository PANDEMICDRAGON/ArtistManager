import { GoogleGenAI } from "@google/genai";

// This service will handle stream monitoring.
// In a real-world scenario, this would connect to Spotify/Apple Music APIs.
// For now, we'll use the Gemini API to "analyze" or "simulate" data if needed,
// but we'll structure it for real API integration.

export interface StreamData {
  platform: 'spotify' | 'apple_music' | 'youtube' | 'tidal';
  streams: number;
  date: string;
}

export interface ArtistAnalytics {
  totalStreams: number;
  monthlyListeners: number;
  topTracks: { name: string; streams: number }[];
  platformBreakdown: { [key: string]: number };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const fetchArtistStreams = async (artistName: string): Promise<ArtistAnalytics> => {
  // In a real app, you'd call Spotify's API here.
  // We'll use Gemini to provide a realistic "snapshot" of data for the demo
  // if no real API key is provided for Spotify.
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate realistic streaming analytics data for the artist "${artistName}". 
      Include total streams, monthly listeners, top 3 tracks with stream counts, and platform breakdown (Spotify, Apple Music, YouTube).
      Return ONLY a JSON object matching this structure:
      {
        "totalStreams": number,
        "monthlyListeners": number,
        "topTracks": [{ "name": string, "streams": number }],
        "platformBreakdown": { "Spotify": number, "Apple Music": number, "YouTube": number }
      }`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text || '{}');
    return {
      totalStreams: data.totalStreams || 0,
      monthlyListeners: data.monthlyListeners || 0,
      topTracks: data.topTracks || [],
      platformBreakdown: data.platformBreakdown || {}
    };
  } catch (error) {
    console.error("Failed to fetch stream data", error);
    // Return mock fallback
    return {
      totalStreams: 1250000,
      monthlyListeners: 45000,
      topTracks: [
        { name: "Midnight City", streams: 500000 },
        { name: "Neon Lights", streams: 350000 },
        { name: "Starlight", streams: 200000 }
      ],
      platformBreakdown: { "Spotify": 600000, "Apple Music": 400000, "YouTube": 250000 }
    };
  }
};

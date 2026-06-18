import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import * as cheerio from 'cheerio';

// Load GEMINI_API_KEY (and any other secrets) from .env.local for local/self-hosted runs.
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3000;

// simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

app.use(express.json());

async function fetchReddit(subreddit: string) {
    try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=15`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LiveIdeaGen/1.0' } });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data.children.map((child: any) => ({
            title: child.data.title,
            score: child.data.score,
            comments: child.data.num_comments
        }));
    } catch (err) {
        console.error(`Failed to fetch reddit ${subreddit}`, err);
        return [];
    }
}

async function fetchRss(url: string) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LiveIdeaGen/1.0' } });
        if (!res.ok) return [];
        const text = await res.text();
        const $ = cheerio.load(text, { xmlMode: true });
        const items: any[] = [];
        $('item').each((i, el) => {
            if (i >= 15) return;
            items.push({
                title: $(el).find('title').text(),
                description: $(el).find('description').text().replace(/(<([^>]+)>)/gi, "").substring(0, 150),
            });
        });
        return items;
    } catch (e) {
        console.error('RSS fetch error', url, e);
        return [];
    }
}

async function fetchRedditSearch(query: string) {
    try {
        const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=hot&limit=15`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LiveIdeaGen/1.0' } });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data.children.map((child: any) => ({
            title: child.data.title,
            score: child.data.score,
            comments: child.data.num_comments
        }));
    } catch (err) {
        console.error(`Failed to fetch reddit search ${query}`, err);
        return [];
    }
}

async function scrapeData(category: string) {
    let rawData: any[] = [];
    
    if (category === 'Tech Gadgets') {
        const [reddit, rss] = await Promise.all([
            fetchReddit('gadgets'),
            fetchRss('https://techcrunch.com/category/gadgets/feed/')
        ]);
        rawData = [...reddit, ...rss];
    } else if (category === 'Startup Ideas') {
        const [reddit, rss] = await Promise.all([
            fetchReddit('startups'),
            fetchRss('https://hnrss.org/frontpage')
        ]);
        rawData = [...reddit, ...rss];
    } else if (category === 'Marketing Trends') {
        const [reddit1, reddit2] = await Promise.all([
            fetchReddit('marketing'),
            fetchReddit('socialmedia')
        ]);
        rawData = [...reddit1, ...reddit2];
    } else {
        // Fallback
        rawData = await fetchRedditSearch(category);
    }
    
    return rawData;
}

app.post('/api/ideas', async (req, res) => {
    const { category, apiKeys } = req.body;
    
    if (!category) {
        return res.status(400).json({ error: 'Category is required' });
    }
    
    // Prefer keys the user entered in the Settings panel (sent per-request from the browser).
    const allKeys: string[] = [];
    if (Array.isArray(apiKeys)) {
        apiKeys.forEach(k => {
            if (k && k.trim() !== '') allKeys.push(k.trim());
        });
    }

    // Fall back to a server-configured key (GEMINI_API_KEY in .env.local) if the user hasn't
    // entered one in Settings. Handy for self-hosting the app just for yourself.
    if (allKeys.length === 0 && process.env.GEMINI_API_KEY) {
        allKeys.push(process.env.GEMINI_API_KEY);
    }

    if (allKeys.length === 0) {
        return res.status(400).json({ error: 'Please configure your Gemini API key in Settings first.' });
    }

    const cacheKey = `ideas-${category}`;
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`Cache hit for ${category}`);
        return res.json({ source: 'cache', data: cached.data });
    }
    
    let rawData: any[] = [];
    try {
        console.log(`Scraping data for ${category}...`);
        rawData = await scrapeData(category);
    } catch (err: any) {
        console.error('Scraping error:', err);
    }
        
    let prompt = "";
    if (rawData.length === 0) {
        console.log(`Live data unavailable for ${category}, falling back to Gemini knowledge`);
        prompt = `We attempted to scrape live data for the category "${category}" but it was unavailable. 
Generate 5 distinct, human-readable startup or business ideas for the category "${category}" based on current real-world trends from your knowledge.
Output valid JSON only matching this schema:
{
  "ideas": [
    {
      "title": "Short catchy title",
      "trend": "The underlying trend you are basing this on",
      "description": "How to execute this idea or what the opportunity is",
      "velocity": 85
    }
  ]
}

Assign a 'velocity' score (integer from 1 to 100) representing how fast this trend is growing or its current market momentum.`;
    } else {
        prompt = `Analyze these ${rawData.length} raw items from live scraping for the category "${category}". 
Filter out duplicates and ads. Summarize the top 5 distinct trends into human-readable startup or business ideas. 
Output valid JSON only matching this schema:
{
  "ideas": [
    {
      "title": "Short catchy title",
      "trend": "The underlying trend observed",
      "description": "How to execute this idea or what the opportunity is",
      "velocity": 85
    }
  ]
}

Assign a 'velocity' score (integer from 1 to 100) representing how strongly this surfaced in the live data (based on upvotes, frequency, etc.).

Raw Data:
${JSON.stringify(rawData, null, 2)}`;
    }

    let lastError: any = null;
    let success = false;
    let parsedData: any = null;

    for (let i = 0; i < allKeys.length; i++) {
        try {
            console.log(`Trying API key ${i + 1}/${allKeys.length}...`);
            const ai = new GoogleGenAI({ apiKey: allKeys[i] });

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            ideas: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        title: { type: Type.STRING },
                                        trend: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        velocity: { type: Type.INTEGER }
                                    },
                                    required: ["title", "trend", "description", "velocity"]
                                }
                            }
                        },
                        required: ["ideas"]
                    }
                }
            });
            
            const resultText = response.text;
            if (!resultText) throw new Error("Empty response from AI");
            
            parsedData = JSON.parse(resultText);
            success = true;
            break; // Success! exit loop
        } catch (err: any) {
            console.error(`Error with API key ${i + 1}:`, err?.message || err);
            lastError = err;
            const errString = (err?.message || '') + JSON.stringify(err);
            // Check if it's a quota or demand issue
            if (errString.includes('high demand') || errString.includes('503') || errString.includes('UNAVAILABLE') || errString.includes('quota') || errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED')) {
                // Try next key if it's a demand issue
                continue;
            } else {
                // For other errors, break out
                break;
            }
        }
    }

    if (success && parsedData) {
        // Save to cache
        cache.set(cacheKey, { data: parsedData.ideas, timestamp: Date.now() });
        console.log(`Completed synthesis for ${category}`);
        return res.json({ source: 'live', data: parsedData.ideas });
    } else {
        const err = lastError;
        let userMessage = 'Failed to generate ideas';
        const errString = (err?.message || '') + JSON.stringify(err);
        if (errString.includes('high demand') || errString.includes('503') || errString.includes('UNAVAILABLE') || errString.includes('overloaded') || errString.includes('quota') || errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED')) {
            console.log("Fallback due to heavy AI demand or quota limits");
            const fallbackIdeas = [
                {
                    title: "Live Idea: " + category + " Generator",
                    trend: "Stable/Rising",
                    description: "Due to high current AI demand or quota limits, this is a simulated live result. All provided API keys are overloaded or exceeded their quotas. Please try again soon to get synthesized live scraping results.",
                    velocity: 80
                },
                {
                    title: category + " Optimization Tool",
                    trend: "Efficiency & Automation",
                    description: "An AI-powered system designed to automate repetitive tasks specific to the " + category + " industry.",
                    velocity: 60 + Math.floor(Math.random() * 30)
                }
            ];
            return res.json({ source: 'live (fallback)', data: fallbackIdeas });
        }
        return res.status(500).json({ error: userMessage, details: err?.message || 'Unknown error' });
    }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

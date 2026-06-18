# Live Idea Generator

A small full-stack app that turns *right-now* internet chatter into structured startup/business ideas. Pick a category, hit generate, and it scrapes live posts from Reddit and relevant RSS feeds, hands the raw data to Gemini, and gets back a ranked list of ideas with a "velocity" score showing how strongly each trend is surfacing in the data.

## What it actually does

1. **You pick a category** — from a searchable list of 200+ industries/niches (or type your own custom one).
2. **The server scrapes live sources** for that category:
   - `Tech Gadgets` → r/gadgets + TechCrunch's gadgets RSS feed
   - `Startup Ideas` → r/startups + Hacker News front page (via hnrss)
   - `Marketing Trends` → r/marketing + r/socialmedia
   - Anything else → a live Reddit search for that term
3. **Gemini synthesizes the raw posts** into 5 distinct ideas (title, underlying trend, how to execute it, and a 1–100 velocity score), returned as structured JSON.
4. **Results are cached** for an hour per category, so repeated requests don't re-scrape or re-call the API.
5. If scraping turns up nothing, the server still asks Gemini to generate ideas from its own knowledge instead of failing outright. If every Gemini key you've provided is rate-limited/overloaded, it returns a clearly-labeled fallback result rather than an error page.

The frontend also shows an optimistic "historical preview" instantly for the three built-in categories above, then swaps it for the live result once the request finishes — so the UI never feels like it's just sitting there waiting.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Recharts (the velocity comparison bar chart), Motion (animations), lucide-react (icons)
- **Backend:** Express + TypeScript, running via `tsx` in dev and bundled with `esbuild` for production
- **Scraping:** native `fetch` for Reddit's JSON endpoints, `cheerio` for parsing RSS/XML feeds
- **AI:** Google's `@google/genai` SDK calling `gemini-2.0-flash` with a JSON response schema

## Getting a Gemini API key

You'll need at least one Gemini API key, free to generate at [Google AI Studio](https://aistudio.google.com/app/apikey).

There are two ways to provide it:

- **Per-browser (default):** click **Settings** in the app and paste in up to 3 keys. They're stored in your browser's `localStorage` and sent with each request — handy if you're sharing this app with other people, since everyone uses their own key/quota. The app will automatically retry with your next key if one hits a rate limit.
- **Server-side (optional, for solo self-hosting):** copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`. The server falls back to this key whenever no key has been entered in Settings, so you can skip that step entirely if you're the only one using your deployment.

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Then open the URL it prints (defaults to `http://localhost:3000`) and add your Gemini API key via the Settings button.

## Build for production

```bash
npm run build
npm start
```

This builds the static frontend with Vite and bundles `server.ts` into `dist/server.cjs` with esbuild, then serves both from a single Express process.

## Project structure

```
server.ts          Express server: scraping logic, Gemini calls, caching, /api/ideas endpoint
src/App.tsx         Main UI: category picker, results list, velocity chart, Settings modal
src/categories.ts   The list of selectable categories
src/types.ts        Shared TypeScript types
```

## Notes

- The in-memory cache is per-process, so it resets on server restart and isn't shared across multiple instances if you ever deploy this behind a load balancer.
- Reddit's public JSON endpoints can rate-limit or block default-looking traffic; the scraper sends a custom `User-Agent` to reduce that risk, but it isn't using Reddit's authenticated API, so don't rely on this for anything high-volume.
- Velocity scores are model-generated estimates of trend strength, not a precise metric — treat them as a sorting hint, not ground truth.

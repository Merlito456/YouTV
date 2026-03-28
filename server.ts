import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Fetch YouTube Metadata without Data API v3
  app.get("/api/youtube/metadata", async (req, res) => {
    const { videoId } = req.query;
    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: "videoId is required" });
    }

    try {
      console.log(`[Server] Fetching metadata for video: ${videoId}`);
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        console.error(`[Server] YouTube returned status ${response.status} for ${videoId}`);
        return res.status(response.status).json({ error: `YouTube returned ${response.status}` });
      }

      const html = await response.text();
      
      // Try to find ytInitialPlayerResponse in the HTML
      // YouTube often changes the variable name or how it's assigned
      const patterns = [
        /ytInitialPlayerResponse\s*=\s*({.+?});/,
        /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/,
        /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?});/
      ];

      let playerResponse: any = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          try {
            playerResponse = JSON.parse(match[1]);
            console.log(`[Server] Successfully parsed playerResponse for ${videoId}`);
            break;
          } catch (e) {
            console.warn(`[Server] Failed to parse matched JSON for ${videoId} with pattern ${pattern}`);
          }
        }
      }

      // If playerResponse failed, try ytInitialData
      if (!playerResponse) {
        const dataMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
        if (dataMatch) {
          try {
            const initialData = JSON.parse(dataMatch[1]);
            const metadata = initialData.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;
            if (metadata) {
              console.log(`[Server] Found metadata in ytInitialData for ${videoId}`);
              return res.json({
                id: videoId,
                title: metadata.title?.runs?.[0]?.text || 'Unknown Title',
                duration: 600, // Duration is harder to find in initialData
                description: '',
                thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                isLive: false,
                author: ''
              });
            }
          } catch (e) {
            console.warn(`[Server] Failed to parse ytInitialData for ${videoId}`);
          }
        }
      }

      if (playerResponse && playerResponse.videoDetails) {
        const videoDetails = playerResponse.videoDetails;
        
        return res.json({
          id: videoId,
          title: videoDetails.title || 'Unknown Title',
          duration: parseInt(videoDetails.lengthSeconds) || 600,
          description: videoDetails.shortDescription || '',
          thumbnail: videoDetails.thumbnail?.thumbnails?.[0]?.url || '',
          isLive: !!videoDetails.isLiveContent,
          author: videoDetails.author || ''
        });
      }

      console.warn(`[Server] Could not find playerResponse in HTML for ${videoId}, using fallback meta tags`);

      // Fallback: Parse from meta tags using JSDOM
      const dom = new JSDOM(html);
      const title = dom.window.document.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                    dom.window.document.querySelector('meta[name="title"]')?.getAttribute('content') || 
                    dom.window.document.querySelector('title')?.textContent?.replace(' - YouTube', '') || 
                    'Unknown Title';
      
      const description = dom.window.document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                          dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      
      const thumbnail = dom.window.document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

      res.json({
        id: videoId,
        title,
        duration: 600, // Default 10 mins if not found
        description,
        thumbnail,
        isLive: false
      });

    } catch (error) {
      console.error(`[Server] Error fetching YouTube metadata for ${videoId}:`, error);
      res.status(500).json({ error: "Internal server error fetching metadata" });
    }
  });

  // API Route: Fetch Playlist Video IDs without Data API v3
  app.get("/api/youtube/playlist", async (req, res) => {
    const { playlistId } = req.query;
    if (!playlistId || typeof playlistId !== 'string') {
      return res.status(400).json({ error: "playlistId is required" });
    }

    try {
      console.log(`[Server] Fetching playlist: ${playlistId}`);
      const url = `https://www.youtube.com/playlist?list=${playlistId}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        console.error(`[Server] YouTube returned status ${response.status} for playlist ${playlistId}`);
        return res.status(response.status).json({ error: `YouTube returned ${response.status}` });
      }

      const html = await response.text();
      const dataMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
      
      if (!dataMatch) {
        console.warn(`[Server] Could not find ytInitialData for playlist ${playlistId}`);
        return res.status(404).json({ error: "Could not find playlist data" });
      }

      const initialData = JSON.parse(dataMatch[1]);
      const videoIds: string[] = [];

      // Extract video IDs from the complex ytInitialData structure
      // Path 1: Standard playlist view
      let contents = initialData.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
      
      // Path 2: Alternative structure
      if (!contents) {
        contents = initialData.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
      }

      if (contents && Array.isArray(contents)) {
        contents.forEach((item: any) => {
          const videoId = item.playlistVideoRenderer?.videoId;
          if (videoId) videoIds.push(videoId);
        });
      }

      console.log(`[Server] Found ${videoIds.length} videos in playlist ${playlistId}`);
      res.json({ videoIds });
    } catch (error) {
      console.error(`[Server] Error fetching playlist ${playlistId}:`, error);
      res.status(500).json({ error: "Internal server error fetching playlist" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

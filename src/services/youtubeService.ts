const API_KEYS = [
  import.meta.env.VITE_YOUTUBE_API_KEY_1,
  import.meta.env.VITE_YOUTUBE_API_KEY_2,
  import.meta.env.VITE_YOUTUBE_API_KEY_3,
  import.meta.env.VITE_YOUTUBE_API_KEY_4,
  import.meta.env.VITE_YOUTUBE_API_KEY_5,
  import.meta.env.VITE_YOUTUBE_API_KEY, // Fallback to original
].filter(Boolean);

let currentKeyIndex = 0;

function getApiKey(): string {
  if (API_KEYS.length === 0) {
    return 'AIzaSyBHWwAE64yVDry6u_y1gF-c6-rRrs7Wzm4'; // Hardcoded fallback if nothing is set
  }
  const key = API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

export async function detectLiveVideoIds(sourceId: string): Promise<string[]> {
  const apiKey = getApiKey();
  try {
    console.log(`Detecting live videos for source: ${sourceId} using key index ${currentKeyIndex}`);
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&maxResults=5&key=${apiKey}`;
    
    if (sourceId.startsWith('@')) {
      // If it's a handle (@name), we first need to get the channel ID
      const handleResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(sourceId)}&key=${apiKey}`
      );
      const handleData = await handleResponse.json();
      
      if (handleData.error) {
        console.error("YouTube API Error (Handle Search):", handleData.error);
        return [];
      }

      if (handleData.items && handleData.items.length > 0) {
        const channelId = handleData.items[0].id.channelId;
        console.log(`Resolved handle ${sourceId} to channelId: ${channelId}`);
        url += `&channelId=${channelId}`;
      } else {
        console.warn(`Could not resolve handle: ${sourceId}`);
        return [];
      }
    } else if (sourceId.length === 24 && sourceId.startsWith('UC')) {
      // It's a standard YouTube channel ID
      url += `&channelId=${sourceId}`;
    } else {
      // It's likely a search query or a legacy username
      // We'll use it as a query parameter
      url += `&q=${encodeURIComponent(sourceId)}`;
    }

    console.log(`Fetching live streams from: ${url.replace(apiKey, 'REDACTED_KEY')}`);
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("YouTube API Error (Live Search):", data.error);
      return [];
    }
    
    if (data.items && data.items.length > 0) {
      const videoIds = data.items.map((item: any) => item.id.videoId);
      console.log(`Found ${videoIds.length} live videos for ${sourceId}:`, videoIds);
      return videoIds;
    }
    
    console.log(`No live videos found for ${sourceId}`);
    return [];
  } catch (error) {
    console.error("Error detecting live videos with YouTube API:", error);
    return [];
  }
}

export async function fetchPlaylistVideos(playlistId: string, limit: number = 0): Promise<any[]> {
  const apiKey = getApiKey();
  try {
    let allItems: any[] = [];
    let nextPageToken = "";
    
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.items) {
        allItems.push(...data.items);
      }
      
      nextPageToken = data.nextPageToken;
      
      // If limit is set and we reached it, stop
      if (limit > 0 && allItems.length >= limit) {
        allItems = allItems.slice(0, limit);
        break;
      }
    } while (nextPageToken);
    
    return allItems;
  } catch (error) {
    console.error("Error fetching playlist videos:", error);
    return [];
  }
}

export async function getBatchVideoDetails(videoIds: string[]): Promise<any[]> {
  const apiKey = getApiKey();
  try {
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    let allDetails: any[] = [];
    for (const chunk of chunks) {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(',')}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.items) {
        allDetails.push(...data.items);
      }
    }
    return allDetails;
  } catch (error) {
    console.error("Error getting batch video details:", error);
    return [];
  }
}

export async function searchVideos(query: string, maxResults: number = 50, channelId?: string): Promise<any[]> {
  const apiKey = getApiKey();
  try {
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&key=${apiKey}`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (channelId) url += `&channelId=${channelId}`;
    
    const response = await fetch(url);
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error searching videos:", error);
    return [];
  }
}

export async function getVideoDetails(videoId: string): Promise<any | null> {
  const apiKey = getApiKey();
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`
    );
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0];
    }
    return null;
  } catch (error) {
    console.error("Error getting video details:", error);
    return null;
  }
}

export async function isVideoLive(videoId: string): Promise<boolean> {
  const apiKey = getApiKey();
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const video = data.items[0];
      // If it's a live stream, it should have liveStreamingDetails
      // and NOT have an actualEndTime
      if (video.liveStreamingDetails) {
        return !video.liveStreamingDetails.actualEndTime;
      }
      // If it's not a live stream at all, it's not "live" for our purposes
      return false;
    }
    return false;
  } catch (error) {
    console.error("Error checking if video is live:", error);
    return false;
  }
}

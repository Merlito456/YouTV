const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || 'AIzaSyBHWwAE64yVDry6u_y1gF-c6-rRrs7Wzm4';

export async function detectLiveVideoIds(channelId: string): Promise<string[]> {
  try {
    // If it's a handle (@name), we first need to get the channel ID
    let finalChannelId = channelId;
    if (channelId.startsWith('@')) {
      const handleResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channelId)}&key=${YOUTUBE_API_KEY}`
      );
      const handleData = await handleResponse.json();
      if (handleData.items && handleData.items.length > 0) {
        finalChannelId = handleData.items[0].id.channelId;
      } else {
        return [];
      }
    }

    // Search for active live streams for this channel
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${finalChannelId}&type=video&eventType=live&key=${YOUTUBE_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items.map((item: any) => item.id.videoId);
    }
    
    return [];
  } catch (error) {
    console.error("Error detecting live videos with YouTube API:", error);
    return [];
  }
}

export async function fetchPlaylistVideos(playlistId: string, limit: number = 0): Promise<any[]> {
  try {
    let allItems: any[] = [];
    let nextPageToken = "";
    
    do {
      const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&pageToken=${nextPageToken}&key=${YOUTUBE_API_KEY}`;
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
  try {
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    let allDetails: any[] = [];
    for (const chunk of chunks) {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`
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
  try {
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
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
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
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

const API_KEYS = [
  import.meta.env.VITE_YOUTUBE_API_KEY_1,
  import.meta.env.VITE_YOUTUBE_API_KEY_2,
  import.meta.env.VITE_YOUTUBE_API_KEY_3,
  import.meta.env.VITE_YOUTUBE_API_KEY_4,
  import.meta.env.VITE_YOUTUBE_API_KEY_5,
  import.meta.env.VITE_YOUTUBE_API_KEY_6,
  import.meta.env.VITE_YOUTUBE_API_KEY_7,
  import.meta.env.VITE_YOUTUBE_API_KEY_8,
  import.meta.env.VITE_YOUTUBE_API_KEY_9,
  import.meta.env.VITE_YOUTUBE_API_KEY_10,
  import.meta.env.VITE_YOUTUBE_API_KEY_11,
  import.meta.env.VITE_YOUTUBE_API_KEY_12,
  import.meta.env.VITE_YOUTUBE_API_KEY_13,
  import.meta.env.VITE_YOUTUBE_API_KEY_14,
  import.meta.env.VITE_YOUTUBE_API_KEY_15,
  import.meta.env.VITE_YOUTUBE_API_KEY_16,
  import.meta.env.VITE_YOUTUBE_API_KEY_17,
  import.meta.env.VITE_YOUTUBE_API_KEY_18,
  import.meta.env.VITE_YOUTUBE_API_KEY_19,
  import.meta.env.VITE_YOUTUBE_API_KEY_20,
  import.meta.env.VITE_YOUTUBE_API_KEY, // Fallback to original
].filter(Boolean);

let currentKeyIndex = 0;

function getApiKey(): string {
  if (API_KEYS.length === 0) {
    return 'AIzaSyBHWwAE64yVDry6u_y1gF-c6-rRrs7Wzm4'; // Hardcoded fallback if nothing is set
  }
  const key = API_KEYS[currentKeyIndex];
  console.log(`[YouTube API] Using key index ${currentKeyIndex + 1} of ${API_KEYS.length}`);
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

export async function getNoApiVideoDetails(videoId: string): Promise<any | null> {
  try {
    const response = await fetch(`/api/youtube/metadata?videoId=${videoId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned ${response.status}`);
    }
    const data = await response.json();
    
    // Map our server response to the YouTube API format expected by the app
    return {
      id: data.id,
      snippet: {
        title: data.title,
        description: data.description,
        thumbnails: {
          default: { url: data.thumbnail }
        }
      },
      contentDetails: {
        duration: `PT${data.duration}S` // Convert seconds to ISO8601 duration
      }
    };
  } catch (error: any) {
    console.error("Error getting no-API video details:", error.message);
    return null;
  }
}

export async function detectLiveVideoIds(sourceId: string): Promise<{ videoIds: string[], resolvedChannelId?: string }> {
  const apiKey = getApiKey();
  try {
    console.log(`[YouTube Service] Detecting live videos for source: ${sourceId}`);
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&eventType=live&maxResults=5&key=${apiKey}`;
    let resolvedChannelId: string | undefined = undefined;
    
    // 1. Try to identify if it's already a channel ID or needs resolution
    const isStandardChannelId = sourceId.length === 24 && sourceId.startsWith('UC');
    
    if (isStandardChannelId) {
      resolvedChannelId = sourceId;
      url += `&channelId=${resolvedChannelId}`;
    } else {
      // Try to resolve handle or username to channel ID
      console.log(`[YouTube Service] Attempting to resolve "${sourceId}" to a channel ID...`);
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(sourceId)}&maxResults=1&key=${apiKey}`;
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      
      if (searchData.items && searchData.items.length > 0) {
        resolvedChannelId = searchData.items[0].id.channelId;
        console.log(`[YouTube Service] Resolved "${sourceId}" to channelId: ${resolvedChannelId}`);
        url += `&channelId=${resolvedChannelId}`;
      } else {
        console.warn(`[YouTube Service] Could not resolve "${sourceId}" to a channel ID. Using as query.`);
        url += `&q=${encodeURIComponent(sourceId)}`;
      }
    }

    console.log(`[YouTube Service] Fetching live streams...`);
    const response = await fetch(url);
    const data = await response.json();
    
    let videoIds: string[] = [];
    
    if (data.error) {
      console.error("[YouTube Service] API Error (Live Search):", data.error);
    } else if (data.items && data.items.length > 0) {
      videoIds = data.items.map((item: any) => item.id.videoId);
      console.log(`[YouTube Service] Found ${videoIds.length} live videos for ${sourceId} via search:`, videoIds);
    }
    
    // FALLBACK: If no live videos found via search and we have a channelId, check activities
    if (videoIds.length === 0 && resolvedChannelId) {
      console.log(`[YouTube Service] Fallback: Checking activities for channel ${resolvedChannelId}...`);
      const activitiesUrl = `https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&channelId=${resolvedChannelId}&maxResults=10&key=${apiKey}`;
      const activitiesResponse = await fetch(activitiesUrl);
      const activitiesData = await activitiesResponse.json();
      
      if (activitiesData.items) {
        // Look for 'liveStream' or 'upload' that might be live
        const potentialVideoIds = activitiesData.items
          .filter((item: any) => item.snippet.type === 'liveStream' || item.snippet.type === 'upload')
          .map((item: any) => item.contentDetails.liveStream?.videoId || item.contentDetails.upload?.videoId)
          .filter(Boolean);
          
        if (potentialVideoIds.length > 0) {
          console.log(`[YouTube Service] Checking ${potentialVideoIds.length} potential videos from activities for live status...`);
          // We need to check if these are actually live
          const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${potentialVideoIds.join(',')}&key=${apiKey}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          
          if (detailsData.items) {
            const activeLiveIds = detailsData.items
              .filter((item: any) => item.liveStreamingDetails && !item.liveStreamingDetails.actualEndTime)
              .map((item: any) => item.id);
              
            if (activeLiveIds.length > 0) {
              console.log(`[YouTube Service] Found ${activeLiveIds.length} live videos for ${sourceId} via activities:`, activeLiveIds);
              videoIds = activeLiveIds;
            }
          }
        }
      }
    }
    
    if (videoIds.length > 0) {
      return { videoIds, resolvedChannelId };
    }
    
    console.log(`[YouTube Service] No live videos found for ${sourceId}`);
    return { videoIds: [], resolvedChannelId };
  } catch (error) {
    console.error("[YouTube Service] Error detecting live videos:", error);
    return { videoIds: [] };
  }
}

export async function getNoApiPlaylistVideos(playlistId: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/youtube/playlist?playlistId=${playlistId}`);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[No-API Playlist] Server returned error:`, errorData);
      return [];
    }
    const data = await response.json();
    return data.videoIds || [];
  } catch (error) {
    console.error(`[No-API Playlist] Error fetching playlist ${playlistId}:`, error);
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

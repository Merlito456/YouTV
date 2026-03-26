export interface Channel {
  id: string;
  name: string;
  query?: string;
  playlist_id?: string;
  username?: string;
  channel_id?: string;
  is_live: boolean;
  live_video_id?: string;
  created_at?: string;
}

export interface Program {
  id: string;
  channel_id: string;
  title: string;
  description?: string;
  video_id?: string; // Added to support "unlimited links" as programs
  start_time: string; // ISO string
  end_time: string;   // ISO string
  created_at?: string;
}

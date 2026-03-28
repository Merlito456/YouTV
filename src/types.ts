export interface Channel {
  id: string;
  name: string;
  query?: string;
  playlist_id?: string;
  username?: string;
  channel_id?: string;
  is_live: boolean;
  live_video_id?: string;
  last_live_check?: string;
  order_index?: number;
  created_at: string;
}

export interface Program {
  id: string;
  channel_id: string;
  title: string;
  video_id: string;
  duration: number;
  description?: string;
  created_at: string;
}

export interface ScheduledProgram extends Program {
  start: Date;
  end: Date;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

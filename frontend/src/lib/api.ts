const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface Chat {
  id: number;
  chat_id: string;
  chat_type: 'private' | 'group' | 'broadcast';
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  total_message_count: number;
  is_pinned: boolean;
  is_archived: boolean;
  participant_count: number | null;
}

export interface Message {
  id: number;
  message_id: string;
  chat_id: number;
  sender_id: string;
  sender_name: string | null;
  is_from_me: boolean;
  body: string | null;
  message_type: string;
  has_media: boolean;
  media_url: string | null;
  media_filename: string | null;
  media_mimetype: string | null;
  media_caption: string | null;
  timestamp: string;
  is_forwarded: boolean;
  is_starred: boolean;
  mentions: string[] | null;
  reactions: Record<string, string[]> | null;
  quotedMessage?: {
    id: number;
    body: string | null;
    sender_name: string | null;
    message_type: string;
  } | null;
}

export interface SearchResult {
  id: number;
  body: string;
  timestamp: string;
  chat_name: string;
  chat_type: string;
  sender_name: string;
  rank: number;
  chat_id: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getChats(page = 1, limit = 50, archived = false): Promise<PaginatedResponse<Chat>> {
  return fetchApi(`/api/chats?page=${page}&limit=${limit}&archived=${archived}`);
}

export async function getChat(id: number): Promise<Chat> {
  return fetchApi(`/api/chats/${id}`);
}

export async function getChatMessages(chatId: number, page = 1, limit = 100): Promise<PaginatedResponse<Message>> {
  return fetchApi(`/api/chats/${chatId}/messages?page=${page}&limit=${limit}`);
}

export async function searchMessages(query: string, page = 1): Promise<PaginatedResponse<SearchResult>> {
  return fetchApi(`/api/search?q=${encodeURIComponent(query)}&page=${page}`);
}

export async function getMediaMessages(chatId: number, page = 1): Promise<PaginatedResponse<Message>> {
  return fetchApi(`/api/chats/${chatId}/messages?page=${page}&limit=50`);
}

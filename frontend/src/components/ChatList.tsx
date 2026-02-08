"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getChats, searchMessages, type Chat, type SearchResult } from "@/lib/api";

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function ChatAvatar({ name, chatType }: { name: string | null; chatType: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const bgColors: Record<string, string> = {
    A: "#e17076", B: "#7bc862", C: "#e5ca77", D: "#65aadd", E: "#ee7aae",
    F: "#6ec9cb", G: "#faa774", H: "#a695e7", I: "#e17076", J: "#7bc862",
    K: "#e5ca77", L: "#65aadd", M: "#ee7aae", N: "#6ec9cb", O: "#faa774",
    P: "#a695e7", Q: "#e17076", R: "#7bc862", S: "#e5ca77", T: "#65aadd",
    U: "#ee7aae", V: "#6ec9cb", W: "#faa774", X: "#a695e7", Y: "#e17076",
    Z: "#7bc862",
  };
  const bg = bgColors[initial] || "#8696a0";

  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
      style={{ backgroundColor: bg }}
    >
      {chatType === "group" ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
        </svg>
      ) : (
        initial
      )}
    </div>
  );
}

function ChatItem({
  chat,
  isActive,
  onClick,
}: {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
      style={{
        backgroundColor: isActive ? "var(--bg-secondary)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
      }}
      onClick={onClick}
    >
      <ChatAvatar name={chat.name} chatType={chat.chat_type} />
      <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex justify-between items-center">
          <span className="font-medium truncate text-[15px]" style={{ color: "var(--text-primary)" }}>
            {chat.name || chat.chat_id}
          </span>
          <span className="text-xs ml-2 shrink-0" style={{ color: chat.unread_count > 0 ? "var(--accent)" : "var(--text-secondary)" }}>
            {formatTime(chat.last_message_at)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
            {chat.last_message_preview || "No messages yet"}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {chat.is_pinned && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text-secondary)">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
              </svg>
            )}
            {chat.unread_count > 0 && (
              <span
                className="text-xs text-white rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {chat.unread_count > 99 ? "99+" : chat.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchResultItem({
  result,
  query,
  onClick,
}: {
  result: SearchResult;
  query: string;
  onClick: () => void;
}) {
  const highlightText = (text: string, q: string) => {
    if (!q) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <strong key={i} style={{ color: "var(--text-primary)" }}>{part}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
      style={{ backgroundColor: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 bg-gray-400">
        {(result.chat_name || "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 border-b py-1" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex justify-between items-center">
          <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>
            {result.chat_name}
          </span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {formatTime(result.timestamp)}
          </span>
        </div>
        <div className="text-sm truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {result.sender_name && (
            <span style={{ color: "var(--text-primary)" }}>{result.sender_name}: </span>
          )}
          {highlightText(result.body, query)}
        </div>
      </div>
    </div>
  );
}

export default function ChatList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChatId = searchParams.get("chatId");

  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load chats
  useEffect(() => {
    setLoading(true);
    getChats(1, 50)
      .then((res) => {
        setChats(res.data);
        setHasMore(res.pagination.page < res.pagination.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      searchMessages(searchQuery)
        .then((res) => {
          setSearchResults(res.data);
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loadingMore || !hasMore || searchQuery) return;

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setLoadingMore(true);
      const nextPage = page + 1;
      getChats(nextPage, 50)
        .then((res) => {
          setChats((prev) => [...prev, ...res.data]);
          setPage(nextPage);
          setHasMore(res.pagination.page < res.pagination.totalPages);
          setLoadingMore(false);
        })
        .catch(() => setLoadingMore(false));
    }
  }, [page, hasMore, loadingMore, searchQuery]);

  const selectChat = (chatId: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("chatId", chatId.toString());
    router.push(`?${params.toString()}`);
  };

  // Sort chats: pinned first, then by last_message_at
  const sortedChats = [...chats].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });

  const showSearch = searchQuery.trim().length > 0;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--bg-primary)" }}>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          WhatsApp Mail
        </h1>
        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
          {chats.length} chats
        </span>
      </div>

      {/* Search input */}
      <div className="px-3 py-2" style={{ background: "var(--bg-primary)" }}>
        <div className="flex items-center rounded-lg px-3 py-1.5" style={{ background: "var(--bg-secondary)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--text-secondary)" className="shrink-0">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search messages..."
            className="flex-1 ml-3 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="ml-2 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chat list / Search results */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }} />
          </div>
        ) : showSearch ? (
          <>
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }} />
                <span className="ml-2 text-sm" style={{ color: "var(--text-secondary)" }}>Searching...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No results found for &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </div>
                {searchResults.map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    query={searchQuery}
                    onClick={() => selectChat(result.chat_id)}
                  />
                ))}
              </>
            )}
          </>
        ) : sortedChats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No chats found</p>
          </div>
        ) : (
          <>
            {sortedChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id.toString()}
                onClick={() => selectChat(chat.id)}
              />
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

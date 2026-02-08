"use client";

import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/api";

function formatTime(dateStr: string): string {
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
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <strong key={i} className="font-bold" style={{ color: "var(--text-primary)" }}>
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface SearchPanelProps {
  results: SearchResult[];
  query: string;
  loading: boolean;
}

export default function SearchPanel({ results, query, loading }: SearchPanelProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }}
        />
        <span className="ml-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Searching...
        </span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--text-secondary)" className="mx-auto mb-3 opacity-50">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          No results found for &quot;{query}&quot;
        </p>
      </div>
    );
  }

  // Group results by chat
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const key = result.chat_name || "Unknown Chat";
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {});

  const navigateToChat = (chatId: number) => {
    router.push(`?chatId=${chatId}`);
  };

  return (
    <div>
      <div
        className="px-4 py-2 text-xs font-medium uppercase tracking-wider sticky top-0 z-10"
        style={{ color: "var(--accent)", backgroundColor: "var(--bg-primary)" }}
      >
        {results.length} result{results.length !== 1 ? "s" : ""} found
      </div>

      {Object.entries(grouped).map(([chatName, chatResults]) => (
        <div key={chatName}>
          {/* Chat group header */}
          <div
            className="px-4 py-1.5 text-xs font-semibold sticky top-7 z-10"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            {chatName} ({chatResults.length})
          </div>

          {/* Results in this chat */}
          {chatResults.map((result) => (
            <div
              key={result.id}
              className="px-4 py-2.5 cursor-pointer transition-colors border-b"
              style={{ borderColor: "var(--border-color)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              onClick={() => navigateToChat(result.chat_id)}
            >
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                  {result.sender_name || "Unknown"}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {formatTime(result.timestamp)}
                </span>
              </div>
              <div className="text-sm leading-5" style={{ color: "var(--text-secondary)" }}>
                {highlightText(result.body, query)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

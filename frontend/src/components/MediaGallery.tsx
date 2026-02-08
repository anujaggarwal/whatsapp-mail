"use client";

import { useState, useEffect } from "react";
import { getChatMessages, type Message } from "@/lib/api";

type MediaFilter = "all" | "images" | "videos" | "documents";

function getMediaType(message: Message): MediaFilter | null {
  if (!message.has_media) return null;
  const mime = message.media_mimetype || "";
  if (mime.startsWith("image/")) return "images";
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("application/") || mime.startsWith("text/")) return "documents";
  return "all";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LightboxModal({
  message,
  onClose,
}: {
  message: Message;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {message.media_mimetype?.startsWith("image/") && message.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.media_url}
            alt={message.media_filename || "Media"}
            className="max-w-full max-h-[85vh] object-contain rounded"
          />
        ) : message.media_mimetype?.startsWith("video/") && message.media_url ? (
          <video
            src={message.media_url}
            controls
            className="max-w-full max-h-[85vh] rounded"
          />
        ) : null}
        <div className="text-center mt-3 text-white">
          <p className="text-sm">{message.media_filename || "Untitled"}</p>
          <p className="text-xs opacity-60 mt-1">{formatDate(message.timestamp)}</p>
        </div>
      </div>
    </div>
  );
}

export default function MediaGallery({ chatId }: { chatId: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setPage(1);

    getChatMessages(chatId, 1, 50)
      .then((res) => {
        const mediaMessages = res.data.filter((m) => m.has_media);
        setMessages(mediaMessages);
        setHasMore(res.pagination.page < res.pagination.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chatId]);

  const loadMore = () => {
    if (!hasMore) return;
    const nextPage = page + 1;
    getChatMessages(chatId, nextPage, 50)
      .then((res) => {
        const mediaMessages = res.data.filter((m) => m.has_media);
        setMessages((prev) => [...prev, ...mediaMessages]);
        setPage(nextPage);
        setHasMore(res.pagination.page < res.pagination.totalPages);
      });
  };

  const filteredMessages = messages.filter((m) => {
    if (filter === "all") return true;
    return getMediaType(m) === filter;
  });

  const tabs: { label: string; value: MediaFilter }[] = [
    { label: "All", value: "all" },
    { label: "Images", value: "images" },
    { label: "Videos", value: "videos" },
    { label: "Documents", value: "documents" },
  ];

  return (
    <div className="p-3" style={{ background: "var(--bg-primary)", maxHeight: "300px", overflowY: "auto" }}>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className="px-3 py-1 text-xs rounded-full transition-colors font-medium"
            style={{
              backgroundColor: filter === tab.value ? "var(--accent)" : "var(--bg-secondary)",
              color: filter === tab.value ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }} />
        </div>
      ) : filteredMessages.length === 0 ? (
        <p className="text-center text-sm py-4" style={{ color: "var(--text-secondary)" }}>
          No media found
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {filteredMessages.map((message) => {
              const isImage = message.media_mimetype?.startsWith("image/");
              const isVideo = message.media_mimetype?.startsWith("video/");

              return (
                <div
                  key={message.id}
                  className="relative aspect-square rounded overflow-hidden cursor-pointer group"
                  style={{ backgroundColor: "var(--bg-secondary)" }}
                  onClick={() => setSelectedMessage(message)}
                >
                  {isImage && message.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={message.media_url}
                      alt={message.media_filename || "Image"}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo && message.media_url ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--text-secondary)">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--text-secondary)">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                      </svg>
                      <span className="text-[10px] mt-1 text-center truncate w-full" style={{ color: "var(--text-secondary)" }}>
                        {message.media_filename || "File"}
                      </span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                  {/* Date badge */}
                  <div className="absolute bottom-1 right-1 text-[9px] px-1 py-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatDate(message.timestamp)}
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full mt-2 py-1.5 text-xs font-medium rounded transition-colors"
              style={{ color: "var(--accent)", backgroundColor: "var(--bg-secondary)" }}
            >
              Load more media
            </button>
          )}
        </>
      )}

      {/* Lightbox */}
      {selectedMessage && (
        <LightboxModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
}

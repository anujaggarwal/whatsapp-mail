"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getChat, getChatMessages, type Chat, type Message } from "@/lib/api";
import MediaGallery from "@/components/MediaGallery";

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
  return date.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

function shouldShowDateSeparator(current: Message, previous: Message | null): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.timestamp).toDateString();
  const previousDate = new Date(previous.timestamp).toDateString();
  return currentDate !== previousDate;
}

function MessageBubble({
  message,
  isGroup,
}: {
  message: Message;
  isGroup: boolean;
}) {
  const isFromMe = message.is_from_me;

  return (
    <div className={`flex ${isFromMe ? "justify-end" : "justify-start"} mb-1 px-[7%]`}>
      <div
        className="max-w-[65%] rounded-lg px-2.5 py-1.5 relative"
        style={{
          backgroundColor: isFromMe ? "var(--bg-chat-sent)" : "var(--bg-chat-received)",
          boxShadow: "0 1px 0.5px rgba(0, 0, 0, 0.13)",
        }}
      >
        {/* Forwarded label */}
        {message.is_forwarded && (
          <div className="flex items-center gap-1 mb-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text-secondary)">
              <path d="M12 8V4l8 8-8 8v-4H4V8z"/>
            </svg>
            <span className="text-xs italic" style={{ color: "var(--text-secondary)" }}>Forwarded</span>
          </div>
        )}

        {/* Sender name (groups only) */}
        {isGroup && !isFromMe && message.sender_name && (
          <div className="text-xs font-semibold mb-0.5" style={{ color: "var(--accent)" }}>
            {message.sender_name}
          </div>
        )}

        {/* Quoted message */}
        {message.quotedMessage && (
          <div
            className="rounded px-2.5 py-1.5 mb-1 border-l-4 cursor-pointer"
            style={{
              backgroundColor: isFromMe ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.06)",
              borderLeftColor: "var(--accent)",
            }}
          >
            {message.quotedMessage.sender_name && (
              <div className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                {message.quotedMessage.sender_name}
              </div>
            )}
            <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {message.quotedMessage.body || `[${message.quotedMessage.message_type}]`}
            </div>
          </div>
        )}

        {/* Media indicator */}
        {message.has_media && (
          <div className="mb-1">
            {message.media_url ? (
              message.media_mimetype?.startsWith("image/") ? (
                <div className="rounded overflow-hidden mb-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.media_url}
                    alt={message.media_filename || "Image"}
                    className="max-w-full rounded"
                    style={{ maxHeight: "300px", objectFit: "cover" }}
                  />
                </div>
              ) : (
                <a
                  href={message.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded px-2.5 py-2 mb-1"
                  style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--text-secondary)">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                  </svg>
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                      {message.media_filename || "File"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {message.media_mimetype || "Document"}
                    </div>
                  </div>
                </a>
              )
            ) : (
              <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <span>{message.message_type}</span>
              </div>
            )}
          </div>
        )}

        {/* Message body */}
        {(message.body || message.media_caption) && (
          <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">
            {message.body || message.media_caption}
          </div>
        )}

        {/* Timestamp + starred */}
        <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5">
          {message.is_starred && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text-secondary)">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          )}
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {formatMessageTime(message.timestamp)}
          </span>
          {isFromMe && (
            <svg width="16" height="11" viewBox="0 0 16 11" fill="var(--text-secondary)">
              <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 00-.659.003.467.467 0 00-.003.653l2.344 2.442a.469.469 0 00.681-.003l6.523-8.056a.438.438 0 000-.656z"/>
              <path d="M14.757.653a.457.457 0 00-.305-.102.493.493 0 00-.38.178l-6.19 7.636-.672-.697-.006.007-.353-.367a.457.457 0 00-.66.003.467.467 0 00-.003.653l1.03 1.073a.469.469 0 00.68-.003l6.86-8.475a.438.438 0 000-.656z"/>
            </svg>
          )}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
              >
                {emoji} {users.length > 1 && users.length}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatView() {
  const searchParams = useSearchParams();
  const chatIdParam = searchParams.get("chatId");
  const chatId = chatIdParam ? parseInt(chatIdParam) : null;

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showMedia, setShowMedia] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  // Load chat and messages when chatId changes
  useEffect(() => {
    if (!chatId) {
      setChat(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    setPage(1);
    setHasMore(true);
    initialScrollDone.current = false;

    Promise.all([getChat(chatId), getChatMessages(chatId, 1, 100)])
      .then(([chatData, messagesData]) => {
        setChat(chatData);
        setMessages(messagesData.data.reverse());
        setHasMore(messagesData.pagination.page < messagesData.pagination.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chatId]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (messages.length > 0 && !initialScrollDone.current) {
      messagesEndRef.current?.scrollIntoView();
      initialScrollDone.current = true;
    }
  }, [messages]);

  // Load older messages when scrolling to top
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el || loadingMore || !hasMore || !chatId) return;

    if (el.scrollTop < 100) {
      const prevHeight = el.scrollHeight;
      setLoadingMore(true);
      const nextPage = page + 1;
      getChatMessages(chatId, nextPage, 100)
        .then((res) => {
          const olderMessages = res.data.reverse();
          setMessages((prev) => [...olderMessages, ...prev]);
          setPage(nextPage);
          setHasMore(res.pagination.page < res.pagination.totalPages);
          setLoadingMore(false);

          // Maintain scroll position
          requestAnimationFrame(() => {
            if (el) {
              el.scrollTop = el.scrollHeight - prevHeight;
            }
          });
        })
        .catch(() => setLoadingMore(false));
    }
  }, [chatId, page, hasMore, loadingMore]);

  // No chat selected
  if (!chatId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-[240px] h-[240px] mx-auto mb-6 opacity-20">
            <svg viewBox="0 0 303 172" fill="var(--text-secondary)">
              <path d="M229.565 160.229c32.647-16.166 55.458-50.2 55.458-89.346C285.023 31.724 253.3 0 214.142 0c-28.117 0-52.493 16.36-63.967 40.07C138.7 16.36 114.324 0 86.207 0 47.049 0 15.326 31.724 15.326 70.883c0 39.146 22.811 73.18 55.458 89.346l79.392 30.813 79.389-30.813z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-light mb-2" style={{ color: "var(--text-primary)" }}>
            WhatsApp Mail
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Select a chat to start viewing messages
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <>
      {/* Chat header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 border-b"
        style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {(chat?.name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[16px]" style={{ color: "var(--text-primary)" }}>
            {chat?.name || chat?.chat_id || "Chat"}
          </div>
          <div className="text-xs flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            {chat?.chat_type === "group" && (
              <>
                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold" style={{ background: "var(--bg-secondary)" }}>
                  Group
                </span>
                {chat.participant_count && (
                  <span>{chat.participant_count} participants</span>
                )}
              </>
            )}
            {chat?.chat_type === "broadcast" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold" style={{ background: "var(--bg-secondary)" }}>
                Broadcast
              </span>
            )}
            {chat?.total_message_count !== undefined && (
              <span>{chat.total_message_count.toLocaleString()} messages</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowMedia(!showMedia)}
          className="p-2 rounded-full transition-colors"
          style={{ color: showMedia ? "var(--accent)" : "var(--text-secondary)" }}
          title="Media gallery"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </button>
      </div>

      {/* Media gallery panel */}
      {showMedia && chatId && (
        <div className="border-b" style={{ borderColor: "var(--border-color)" }}>
          <MediaGallery chatId={chatId} />
        </div>
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto py-2"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
        onScroll={handleScroll}
      >
        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-3">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border-color)", borderTopColor: "var(--accent)" }} />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No messages in this chat</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDate = shouldShowDateSeparator(message, prevMessage);

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span
                      className="text-xs px-3 py-1 rounded-lg shadow-sm"
                      style={{
                        backgroundColor: "var(--bg-chat-received)",
                        color: "var(--text-secondary)",
                        boxShadow: "0 1px 0.5px rgba(0, 0, 0, 0.13)",
                      }}
                    >
                      {formatDateSeparator(message.timestamp)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={message}
                  isGroup={chat?.chat_type === "group"}
                />
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>
    </>
  );
}

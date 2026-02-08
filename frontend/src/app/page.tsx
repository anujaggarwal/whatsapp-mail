import { Suspense } from "react";
import ChatList from "@/components/ChatList";
import ChatView from "@/components/ChatView";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 flex-1">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--accent)' }} />
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-secondary)' }}>
      {/* Left sidebar */}
      <div className="w-[400px] min-w-[350px] flex flex-col border-r" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
        <Suspense fallback={<LoadingSpinner />}>
          <ChatList />
        </Suspense>
      </div>

      {/* Right main area */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-secondary)' }}>
        <Suspense fallback={<LoadingSpinner />}>
          <ChatView />
        </Suspense>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      <div className="p-6 border-b border-[#e5e5e5] shrink-0">
        <h1 className="text-xl font-bold text-[#1a1a1a]">Chat</h1>
        <p className="text-sm text-[#4a4a4a] mt-1">Conversation history and assistant.</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <p className="text-[#4a4a4a] text-sm">Chat interface will appear here.</p>
      </div>
    </div>
  );
}

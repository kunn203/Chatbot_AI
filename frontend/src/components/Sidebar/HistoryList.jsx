import { MessageSquare, ChevronRight, Trash2 } from 'lucide-react';

export default function HistoryList({ sessions, activeSessionId, onSelectSession, onDeleteSession }) {
  // Bỏ qua tất cả các session rỗng chưa có ai chat (chỉ có đúng 1 tin nhắn chào mặc định của AI)
  const displaySessions = sessions.filter(s => s.messages.length > 1);

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Chat History</h2>
        <p className="text-gray-500">Pick up where you left off in your previous conversations.</p>
      </div>

      {displaySessions.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
           <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
           <p className="text-gray-500">You haven't started any conversations yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displaySessions.map(session => (
            <div 
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`bg-white border rounded-xl p-5 flex items-center justify-between cursor-pointer transition-all hover:shadow-md ${session.id === activeSessionId ? 'border-primary ring-1 ring-primary/20' : 'border-gray-200 hover:border-primary/50'}`}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className={`p-3 rounded-full ${session.id === activeSessionId ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                   <MessageSquare className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h3 className={`font-semibold truncate ${session.id === activeSessionId ? 'text-gray-800' : 'text-gray-600'}`}>
                    {session.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {session.messages.length - 1} messages exchanged
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete conversation"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <ChevronRight className={`w-5 h-5 shrink-0 ${session.id === activeSessionId ? 'text-primary' : 'text-gray-300'}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

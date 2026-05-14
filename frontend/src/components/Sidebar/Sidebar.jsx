import { PlusSquare, UploadCloud, MessageSquare, Trash2 } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onNewChat, sessions, activeSessionId, onSelectSession, onDeleteSession, currentUser }) {
  // Lọc các session rỗng (chỉ có câu chào mặc định)
  const displaySessions = sessions ? sessions.filter(s => s.messages.length > 1) : [];
  return (
    <aside className="w-64 bg-sidebar-bg border-r border-gray-200 flex flex-col p-6 shrink-0">
      
      {/* Brand & User (mock) */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-3 text-white shadow-sm">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        </div>
        <h1 className="text-primary font-bold text-lg text-center">Learning Assistant</h1>
        <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full font-semibold mt-1">RAG Powered</span>
      </div>

      <nav className="flex-1 space-y-2">
        <button 
          onClick={onNewChat}
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'chat' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <PlusSquare className={`w-5 h-5 ${activeTab === 'chat' ? 'text-white' : 'text-gray-500'}`} />
          New Chat
        </button>

        <button 
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'upload' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <UploadCloud className={`w-5 h-5 ${activeTab === 'upload' ? 'text-white' : 'text-gray-500'}`} />
          Upload File
        </button>
      </nav>

      {/* Recents List */}
      {currentUser && (
        <div className="mt-8 flex-1 overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Recent Chats</h3>
          {displaySessions.length === 0 ? (
            <p className="text-sm text-gray-400 px-2 italic">No recent chats</p>
          ) : (
            <div className="space-y-1">
              {displaySessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${session.id === activeSessionId && activeTab === 'chat' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${session.id === activeSessionId && activeTab === 'chat' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <span className="truncate text-sm">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                    title="Delete chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </aside>
  );
}

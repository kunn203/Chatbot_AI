import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import ChatArea from './components/Chat/ChatArea.jsx';
import UploadArea from './components/Upload/UploadArea.jsx';
import Login from './components/Auth/Login.jsx';
import UpdateProfile from './components/Auth/UpdateProfile.jsx';
import { supabase } from './supabaseClient.js';

function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'upload', 'login'

  // ---- QUẢN LÝ ĐĂNG NHẬP (AUTH BẰNG SUPABASE) ----
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserName, setCurrentUserName] = useState('');



  // ---- DỮ LIỆU TẬP TRUNG (LIFTED STATE) ----
  // 1. Quản lý danh sách Materials
  const [materials, setMaterials] = useState([]);

  // 2. Quản lý danh sách các đoạn Chat 
  // Cấu trúc 1 session: { id: string, title: string, messages: array }
  const [sessions, setSessions] = useState([
    { id: 'default', title: 'New Conversation', messages: [{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }] }
  ]);

  // 3. ID của session Chat đang mở
  const [activeSessionId, setActiveSessionId] = useState('default');

  // Hàm tải dữ liệu từ Cloud Supabase
  const loadCloudData = async (userEmail) => {
    if (!userEmail) {
      setMaterials([]);
      setSessions([{ id: 'default', title: 'New Conversation', messages: [{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }] }]);
      setActiveSessionId('default');
      return;
    }

    try {
      // 1. Tải Materials
      const { data: mats } = await supabase.from('rag_materials')
        .select('*')
        .eq('owner', userEmail)
        .order('created_at', { ascending: false });

      if (mats) setMaterials(mats);

      // 2. Tải Sessions
      const { data: sess } = await supabase.from('rag_sessions')
        .select('*')
        .eq('owner', userEmail)
        .order('updated_at', { ascending: false });

      if (sess && sess.length > 0) {
        setSessions(sess);
        setActiveSessionId(sess[0].id);
      } else {
        setSessions([{ id: 'default', title: 'New Conversation', messages: [{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }], owner: userEmail }]);
        setActiveSessionId('default');
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu từ Cloud:", error);
    }
  };

  useEffect(() => {
    // 1. Lấy session hiện tại khi app vừa khởi chạy
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email || null;
      setCurrentUser(email);
      setCurrentUserName(session?.user?.user_metadata?.name || email?.split('@')[0] || '');
      loadCloudData(email);
    });

    // 2. Lắng nghe các thay đổi về Auth (Login, Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || null;
      setCurrentUser(email);
      setCurrentUserName(session?.user?.user_metadata?.name || email?.split('@')[0] || '');

      // Load dữ liệu khi login, và xóa memory khi logout
      loadCloudData(email);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---- ĐỒNG BỘ SESSION LÊN CLOUD SUPABASE BẰNG EFFECT ----
  useEffect(() => {
    const saveSessionsToCloud = async () => {
      if (!currentUser) return;
      const userSessions = sessions.filter(s => s.owner === currentUser);
      if (userSessions.length === 0) return;

      const upsertData = userSessions.map(s => ({
        id: s.id,
        title: s.title,
        messages: s.messages,
        owner: s.owner,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('rag_sessions').upsert(upsertData);
      if (error) console.error("Lỗi khi đồng bộ sessions lên Cloud:", error);
    };

    // Debounce (gom nhóm) lệnh gọi API để tránh Spam Database khi AI đang gõ chữ liên tục
    const timeoutId = setTimeout(() => {
      saveSessionsToCloud();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [sessions, currentUser]);


  // ---- CÁC HÀM XỬ LÝ SỰ KIỆN ----
  // Nút: New Chat
  const handleNewChat = () => {
    const newSession = {
      id: Date.now().toString(),
      title: `Conversation ${sessions.length + 1}`,
      messages: [{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }],
      owner: currentUser
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setActiveTab('chat');
  };

  // Cập nhật messages vào mảng Session hiện tại
  const updateSessionMessages = (actionOrMessages) => {
    setSessions(prev => {
      // Đảm bảo chỉ update vào session của user hiện tại
      const currentSess = currentUser ? prev.filter(s => s.owner === currentUser) : prev.filter(s => !s.owner);
      const activeOrFirst = currentSess.find(s => s.id === activeSessionId) || currentSess[0];
      const targetId = activeOrFirst ? activeOrFirst.id : activeSessionId;

      const isExist = prev.some(s => s.id === targetId);
      if (!isExist) {
        const newMessages = typeof actionOrMessages === 'function'
          ? actionOrMessages([{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }])
          : actionOrMessages;
        const newSession = {
          id: targetId,
          title: newMessages.length > 1 ? newMessages[1].content.substring(0, 25) + '...' : 'New Conversation',
          messages: newMessages,
          owner: currentUser
        };
        // Auto select the new session id
        setTimeout(() => setActiveSessionId(targetId), 0);
        return [newSession, ...prev];
      }

      return prev.map(s => {
        if (s.id === targetId) {
          const updatedMessages = typeof actionOrMessages === 'function' ? actionOrMessages(s.messages) : actionOrMessages;
          let updatedTitle = s.title;
          if (s.messages.length === 1 && updatedMessages.length > 1 && updatedMessages[1].role === 'user') {
            updatedTitle = updatedMessages[1].content.length > 25 ? updatedMessages[1].content.substring(0, 25) + '...' : updatedMessages[1].content;
          }
          return { ...s, messages: updatedMessages, title: updatedTitle };
        }
        return s;
      });
    });
  };

  // Chọn 1 session cũ từ Lịch sử
  const handleSelectSession = (id) => {
    setActiveSessionId(id);
    setActiveTab('chat');
  };

  // Xóa session
  const handleDeleteSession = (id) => {
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== id);
      // Nếu xóa hết sạch thì tự tạo lại 1 cái default rỗng
      if (newSessions.length === 0) {
        return [{ id: 'default', title: 'New Conversation', messages: [{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }] }];
      }
      return newSessions;
    });

    if (activeSessionId === id && sessions.length > 1) {
      // Nhảy sang tab khác hoặc session đầu tiên còn lại
      const remaining = sessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0].id);
    }
  };

  // Lấy ra nội dung của Session đang active
  const userSessions = currentUser ? sessions.filter(s => s.owner === currentUser) : sessions.filter(s => !s.owner);
  const currentSession = userSessions.find(s => s.id === activeSessionId) || userSessions[0] || { messages: [{ role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' }] };
  const userMaterials = currentUser ? materials.filter(m => m.owner === currentUser) : [];

  // Nếu đang ở tab login, hiển thị màn hình Login
  if (activeTab === 'login') {
    return <Login
      onLogin={(email) => { setCurrentUser(email); setActiveTab('chat'); }}
      onCancel={() => setActiveTab('chat')}
    />;
  }

  // Nếu đang ở tab đổi mật khẩu, hiển thị trang đổi mật khẩu
  if (activeTab === 'update-profile') {
    return <UpdateProfile
      onCancel={() => setActiveTab('chat')}
      onSuccess={(newName) => {
        // Cập nhật lại thông tin user hiển thị nếu cần
        setActiveTab('chat');
      }}
    />;
  }

  return (
    <div className="flex h-screen bg-base-100 overflow-hidden font-sans">

      {/* SIDEBAR COMPONENT */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewChat={handleNewChat}
        sessions={userSessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        currentUser={currentUser}
        currentUserName={currentUserName}
      />

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-base-100">
        {activeTab === 'chat' && (
          <ChatArea
            messages={currentSession.messages}
            setMessages={updateSessionMessages}
            currentUser={currentUser}
            currentUserName={currentUserName}
            onNavigateToLogin={() => setActiveTab('login')}
            onNavigateToChangePassword={() => setActiveTab('update-profile')}
          />
        )}

        {activeTab === 'upload' && (
          <UploadArea
            materials={userMaterials}
            setMaterials={setMaterials}
            currentUser={currentUser}
            currentUserName={currentUserName}
            onNavigateToChangePassword={() => setActiveTab('update-profile')}
          />
        )}
      </main>
    </div>
  );
}

export default App;

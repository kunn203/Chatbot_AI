import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import ChatArea from './components/Chat/ChatArea.jsx';
import UploadArea from './components/Upload/UploadArea.jsx';
import Login from './components/Auth/Login.jsx';
import UpdateProfile from './components/Auth/UpdateProfile.jsx';
import { supabase } from './supabaseClient.js';

// Tin nhắn chào mặc định
const DEFAULT_GREETING = { role: 'assistant', content: 'Chào bạn! Bắt đầu một đoạn hội thoại mới nhé. Cần mình giải đáp gì nào?' };

function createDefaultSession(owner = null) {
  return { id: 'default-' + Date.now(), title: 'New Conversation', messages: [DEFAULT_GREETING], owner };
}

function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'upload', 'login'

  // ---- QUẢN LÝ ĐĂNG NHẬP (AUTH BẰNG SUPABASE) ----
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserName, setCurrentUserName] = useState('');

  // Cờ chặn effect đồng bộ khi đang logout (tránh ghi đè dữ liệu cloud bằng session rỗng)
  const isLoggingOut = useRef(false);
  // Cờ chặn effect đồng bộ khi đang tải dữ liệu cloud (tránh ghi đè trước khi load xong)
  const isLoadingCloud = useRef(false);
  // Đã khởi tạo auth lần đầu chưa (tránh onAuthStateChange gọi kép)
  const hasInitialAuth = useRef(false);

  // ---- DỮ LIỆU TẬP TRUNG (LIFTED STATE) ----
  // 1. Quản lý danh sách Materials
  const [materials, setMaterials] = useState([]);

  // 2. Quản lý danh sách các đoạn Chat 
  // Cấu trúc 1 session: { id: string, title: string, messages: array, owner: string|null }
  const [sessions, setSessions] = useState(() => [createDefaultSession()]);

  // 3. ID của session Chat đang mở
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Hàm tải dữ liệu từ Cloud Supabase
  const loadCloudData = useCallback(async (userEmail) => {
    if (!userEmail) {
      // Bật cờ logout TRƯỚC khi reset state → chặn effect đồng bộ ghi đè cloud
      isLoggingOut.current = true;
      const defaultSess = createDefaultSession();
      setMaterials([]);
      setSessions([defaultSess]);
      setActiveSessionId(defaultSess.id);
      return;
    }

    // Đánh dấu đang tải → chặn effect sync ghi đè cloud
    isLoadingCloud.current = true;

    try {
      // 1. Tải Materials
      const { data: mats, error: matsError } = await supabase.from('rag_materials')
        .select('*')
        .eq('owner', userEmail)
        .order('created_at', { ascending: false });

      if (matsError) console.error("Lỗi tải materials:", matsError);
      if (mats) setMaterials(mats);

      // 2. Tải Sessions
      const { data: sess, error: sessError } = await supabase.from('rag_sessions')
        .select('*')
        .eq('owner', userEmail)
        .order('updated_at', { ascending: false });

      if (sessError) console.error("Lỗi tải sessions:", sessError);

      if (sess && sess.length > 0) {
        setSessions(sess);
        setActiveSessionId(sess[0].id);
      } else {
        const defaultSess = createDefaultSession(userEmail);
        setSessions([defaultSess]);
        setActiveSessionId(defaultSess.id);
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu từ Cloud:", error);
    } finally {
      // Tắt cờ loading SAU khi state đã được cập nhật
      setTimeout(() => {
        isLoadingCloud.current = false;
      }, 500);
    }
  }, []);

  useEffect(() => {
    // 1. Lấy session hiện tại khi app vừa khởi chạy
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email || null;
      setCurrentUser(email);
      setCurrentUserName(session?.user?.user_metadata?.name || email?.split('@')[0] || '');
      loadCloudData(email);
      // Đánh dấu đã xong init
      hasInitialAuth.current = true;
    });

    // 2. Lắng nghe các thay đổi về Auth (Login, Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Bỏ qua lần gọi đầu tiên (đã xử lý bởi getSession ở trên)
      if (!hasInitialAuth.current) return;

      const email = session?.user?.email || null;
      setCurrentUser(email);
      setCurrentUserName(session?.user?.user_metadata?.name || email?.split('@')[0] || '');

      // Load dữ liệu khi login, và xóa memory khi logout
      loadCloudData(email);
    });

    return () => subscription.unsubscribe();
  }, [loadCloudData]);

  // ---- ĐỒNG BỘ SESSION LÊN CLOUD SUPABASE BẰNG EFFECT ----
  useEffect(() => {
    const saveSessionsToCloud = async () => {
      // Nếu đang trong quá trình logout → bỏ qua, không ghi đè cloud
      if (isLoggingOut.current) {
        isLoggingOut.current = false; // Reset cờ sau khi đã chặn thành công
        return;
      }
      // Nếu đang tải dữ liệu cloud → bỏ qua (dữ liệu mới load từ cloud, không cần ghi lại)
      if (isLoadingCloud.current) return;
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
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [sessions, currentUser]);


  // ---- CÁC HÀM XỬ LÝ SỰ KIỆN ----
  // Nút: New Chat
  const handleNewChat = () => {
    const newSession = {
      id: Date.now().toString(),
      title: `Conversation ${sessions.filter(s => s.owner === currentUser).length + 1}`,
      messages: [DEFAULT_GREETING],
      owner: currentUser
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveTab('chat');
  };

  // Cập nhật messages vào mảng Session hiện tại
  const updateSessionMessages = (actionOrMessages) => {
    setSessions(prev => {
      // Đảm bảo chỉ update vào session của user hiện tại
      const currentSess = currentUser
        ? prev.filter(s => s.owner === currentUser)
        : prev.filter(s => !s.owner);
      const activeOrFirst = currentSess.find(s => s.id === activeSessionId) || currentSess[0];
      const targetId = activeOrFirst ? activeOrFirst.id : activeSessionId;

      const isExist = prev.some(s => s.id === targetId);
      if (!isExist) {
        const newMessages = typeof actionOrMessages === 'function'
          ? actionOrMessages([DEFAULT_GREETING])
          : actionOrMessages;
        const newSession = {
          id: targetId,
          title: newMessages.length > 1 ? newMessages[1].content.substring(0, 25) + '...' : 'New Conversation',
          messages: newMessages,
          owner: currentUser  // Luôn gắn owner
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
          // Đảm bảo owner luôn được gắn đúng (sửa session cũ bị thiếu owner)
          return { ...s, messages: updatedMessages, title: updatedTitle, owner: s.owner || currentUser };
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

  // Xóa session (cả trên Cloud lẫn local state)
  const handleDeleteSession = async (id) => {
    // 1. Xóa trên Supabase trước (nếu user đã đăng nhập)
    if (currentUser) {
      const { error } = await supabase.from('rag_sessions').delete().eq('id', id).eq('owner', currentUser);
      if (error) console.error("Lỗi khi xóa session trên Cloud:", error);
    }

    // 2. Xóa khỏi local state
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== id);
      // Nếu xóa hết sạch thì tự tạo lại 1 cái default rỗng
      if (newSessions.filter(s => s.owner === currentUser || (!currentUser && !s.owner)).length === 0) {
        const defaultSess = createDefaultSession(currentUser);
        setTimeout(() => setActiveSessionId(defaultSess.id), 0);
        return [...newSessions, defaultSess];
      }
      return newSessions;
    });

    if (activeSessionId === id) {
      // Nhảy sang session đầu tiên còn lại của user
      const remaining = sessions.filter(s => s.id !== id && (s.owner === currentUser || (!currentUser && !s.owner)));
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // Lấy ra nội dung của Session đang active
  const userSessions = currentUser
    ? sessions.filter(s => s.owner === currentUser)
    : sessions.filter(s => !s.owner);

  const currentSession = userSessions.find(s => s.id === activeSessionId)
    || userSessions[0]
    || { id: 'fallback', messages: [DEFAULT_GREETING] };

  // Tự động chọn session đầu tiên nếu activeSessionId không hợp lệ
  useEffect(() => {
    const hasValidSession = userSessions.some(s => s.id === activeSessionId);
    if (!hasValidSession && userSessions.length > 0) {
      setActiveSessionId(userSessions[0].id);
    }
  }, [userSessions, activeSessionId]);

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

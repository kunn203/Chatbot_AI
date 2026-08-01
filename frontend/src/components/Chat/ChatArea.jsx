import { useState, useRef, useEffect } from 'react';
import { Send, User } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import UserProfile from '../Auth/UserProfile';

/**
 * Hàm tự động phát hiện và bọc các ký tự LaTeX để tương thích với KaTeX.
 * Mistral AI thường dùng \( ... \) cho inline và \[ ... \] cho block.
 */
function preprocessLaTeX(content) {
  if (!content) return '';

  let processed = content;

  // 1. Chuyển đổi \[ ... \] thành $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');

  // 2. Chuyển đổi \( ... \) thành $ ... $
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Bước 1: Bảo vệ các block đã có $$ ... $$ (không đụng vào)
  const blocks = [];
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
    blocks.push(match);
    return `%%BLOCK${blocks.length - 1}%%`;
  });

  // Bước 2: Bảo vệ các inline đã có $ ... $ (không đụng vào)
  const inlines = [];
  processed = processed.replace(/\$([^\$]+?)\$/g, (match) => {
    inlines.push(match);
    return `%%INLINE${inlines.length - 1}%%`;
  });

  // Bước 3: Tìm những đoạn LaTeX bị trần (không có dấu $) và tự bọc lại
  processed = processed.replace(
    /(\\(?:frac|sum|prod|int|sqrt|log|ln|sin|cos|tan|lim|infty|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|omega|pi|phi|psi|partial|nabla|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|forall|exists|in|notin|subset|supset|cup|cap|mathbb|mathcal|mathbf|mathrm|text|left|right|begin|end|binom|choose|hat|bar|vec|dot|ddot|tilde|overline|underline)\b[\s\S]*?(?=\s|$))/g,
    (match) => {
      // Chỉ tự bọc nếu nó trông giống một lệnh toán học bị bỏ quên
      if (match.includes('\\begin') && match.includes('\\end')) {
        return `$$${match}$$`;
      }
      return `$${match}$`;
    }
  );

  // Bước 4: Khôi phục lại các block và inline đã bảo vệ
  processed = processed.replace(/%%BLOCK(\d+)%%/g, (_, i) => blocks[i]);
  processed = processed.replace(/%%INLINE(\d+)%%/g, (_, i) => inlines[i]);

  return processed;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ChatArea({ messages, setMessages, currentUser, currentUserName, onNavigateToLogin, onNavigateToChangePassword }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!currentUser) {
      // Đếm số lượng tin nhắn của user trong khung chat hiện tại
      const userMessagesCount = messages.filter(m => m.role === 'user').length;
      if (userMessagesCount >= 3) {
        setMessages(prev => [...prev, { role: 'user', content: input }, {
          role: 'assistant',
          content: '⚠️ **Bạn đã dùng hết 3 lượt hỏi thử nghiệm trong khung chat này.**\n\nVui lòng bấm nút **Login** ở góc trên bên phải để tiếp tục trò chuyện không giới hạn và lưu lại lịch sử hội thoại của bạn.'
        }]);
        setInput('');
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return;
      }
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Bắt đầu đếm thời gian từ lúc gửi request
      const fetchStartTime = Date.now();

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input, currentUser: currentUser }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // Tính toán thời gian đã trôi qua
      const elapsed = Date.now() - fetchStartTime;
      // Đảm bảo 3 dấu chấm (loading) hiện tối thiểu 1 giây (1000ms) để người dùng có cảm giác AI đang "suy nghĩ"
      if (elapsed < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
      }

      // Tắt 3 dấu chấm loading ngay khi Backend bắt đầu trả về stream
      setIsLoading(false);
      // Khởi tạo một tin nhắn trống cho AI để bắt đầu gõ chữ (Streaming)
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let aiResponse = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        aiResponse += chunk;

        // Cập nhật nội dung của tin nhắn cuối cùng liên tục
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = aiResponse;
          return newMsgs;
        });
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Xin lỗi, có lỗi kết nối tới máy chủ AI.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white w-full">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-100 shrink-0 relative">
        <div className="w-24"></div> {/* Spacer to center title */}
        <h2 className="font-bold text-gray-800 tracking-wide text-lg absolute left-1/2 transform -translate-x-1/2">Chatbot AI</h2>
        <div className="w-24 flex justify-end">
          {!currentUser ? (
            <button
              onClick={onNavigateToLogin}
              className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm hover:bg-primary-focus transition-colors"
            >
              Login
            </button>
          ) : (
            <UserProfile
              currentUser={currentUser}
              currentUserName={currentUserName}
              onNavigateToChangePassword={onNavigateToChangePassword}
            />
          )}
        </div>
      </header>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((msg, idx) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={idx}
            className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
              {msg.role === 'assistant' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              ) : <User className="w-5 h-5" />}
            </div>

            {/* Bubble */}
            <div className={`px-5 py-4 rounded-2xl max-w-[85%] text-sm md:text-base leading-relaxed ${msg.role === 'assistant'
              ? 'bg-gray-50 border border-gray-100 text-gray-700 rounded-tl-none prose prose-sm prose-indigo max-w-none'
              : 'bg-primary text-white rounded-tr-none whitespace-pre-wrap'
              }`}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {preprocessLaTeX(msg.content)}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-4xl mx-auto">
            <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-primary text-white shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 rounded-tl-none flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-white border-t border-gray-100">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative group">
          <div className="relative flex items-center rounded-2xl bg-white border border-gray-200 shadow-sm p-1 pl-4 focus-within:border-primary transition">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="w-full bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none py-3"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-3 bg-primary hover:bg-primary-focus transition-colors rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed m-1"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

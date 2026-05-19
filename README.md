# 🤖 RAG Learning Assistant (Gia Sư AI Đa Nền Tảng)

Chào mừng bạn đến với dự án **RAG Learning Assistant** - một trợ lý học tập cá nhân được xây dựng trên nền tảng AI sinh tạo. Hệ thống này sử dụng kỹ thuật RAG (Retrieval-Augmented Generation) để đọc và phân tích các tệp tin PDF của bạn, từ đó trả lời các câu hỏi dựa trên kiến thức từ tệp tài liệu đó một cách siêu chuẩn xác.

## 🚀 Tính năng nổi bật
- **⚡ Phản hồi Siêu tốc (Streaming):** AI trả lời và gõ chữ trực tiếp theo thời gian thực (giống ChatGPT), mang lại trải nghiệm mượt mà.
- **📚 Quản lý Đa Tài liệu:** Tải lên nhiều tệp PDF khác nhau, AI sẽ tự động phân tách và nạp vào bộ nhớ.
- **☁️ 100% Cloud-Native:** Tích hợp **Supabase pgvector** làm Vector Database, mọi lịch sử chat và dữ liệu mã hóa đều được đồng bộ lên đám mây đa thiết bị.
- **🛡️ Đa người dùng (Multi-tenant):** Hệ thống phân quyền chặt chẽ bằng Supabase Auth. Dữ liệu tài liệu của người nào chỉ AI của người đó được phép truy xuất.
- **🗑️ Quên Tài liệu (Xóa File):** Tính năng "làm sạch não" AI - xóa triệt để Vector Embedding của file khi bạn không muốn dùng đến nữa.

---

## 🛠️ Công nghệ sử dụng
- **Frontend:** React, Vite, Tailwind CSS, daisyUI, Supabase JS
- **Backend:** FastAPI, Python, Uvicorn
- **AI & ML:** LangChain, Mistral AI (LLM & Embeddings)
- **Database:** Supabase (PostgreSQL + `pgvector`)

---

## 💻 Hướng dẫn chạy nội bộ (Local)

### 1. Chuẩn bị môi trường (Backend)
Yêu cầu: `Python 3.10+`
```bash
cd backend

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# Tạo file .env và cấu hình API Key
# MISTRAL_API_KEY=your_key
# SUPABASE_URL=your_url
# SUPABASE_SERVICE_KEY=your_service_key

# Khởi động Backend
uvicorn api:app --reload --port 8000
```

### 2. Chuẩn bị môi trường (Frontend)
Yêu cầu: `Node.js 18+`
```bash
cd frontend

# Cài đặt package
npm install

# Tạo file .env cho frontend
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_anon_key
# VITE_API_URL=http://localhost:8000

# Khởi động React Web
npm run dev
```

Truy cập hệ thống thông qua địa chỉ: `http://localhost:5173/`

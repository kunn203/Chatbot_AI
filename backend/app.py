import streamlit as st
import os
import tempfile
from pathlib import Path
from dotenv import load_dotenv

# Import các thành phần nội bộ từ package src đã xây dựng theo chuẩn DSA
from src.data_processing import DocumentProcessor
from src.database import ChromaDBManager
from src.llm import LearningAssistantBot
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# Tải cấu hình API Key từ file .env
load_dotenv()

# --- CẤU HÌNH GIAO DIỆN WEB ---
st.set_page_config(
    page_title="Gia Sư AI - Trợ Lý Học Tập RAG", 
    page_icon="🎓", 
    layout="wide"
)

# --- KHỞI TẠO VÀ CACHE CÁC THÀNH PHẦN NẶNG ---
# Sử dụng cache_resource để giữ model trong RAM, tránh load lại gây lag
@st.cache_resource
def load_embedding_model():
    #Tải mô hình nhúng BGE-m3
    return HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

@st.cache_resource
def get_vector_db():
    #Kết nối với kho dữ liệu ChromaDB
    base_dir = Path(__file__).resolve().parent
    db_dir = base_dir / "chroma_db"
    
    # Đảm bảo thư mục tồn tại
    if not db_dir.exists():
        db_dir.mkdir(parents=True, exist_ok=True)
        
    return Chroma(
        persist_directory=str(db_dir),
        embedding_function=load_embedding_model(),
        collection_name="learning_data"
    )

def get_bot():
    """Khởi tạo thực thể Bot với dữ liệu hiện có."""
    vector_db = get_vector_db()
    return LearningAssistantBot(vector_store=vector_db)

# --- THANH BÊN (SIDEBAR): QUẢN LÝ TÀI LIỆU ---
with st.sidebar:
    st.header("Kho Tài Liệu")
    st.write("Tải lên giáo trình PDF mới để cập nhật kiến thức cho Trợ lý AI.")
    
    uploaded_file = st.file_uploader("Chọn file PDF (Tối đa 200MB)", type="pdf")
    
    if uploaded_file is not None:
        if st.button("Nạp Kiến Thức Mới"):
            with st.status("Đang xử lý tài liệu...", expanded=True) as status:
                # 1. Tạo file tạm để lưu file upload
                st.write("Đang lưu file tạm...")
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(uploaded_file.getvalue())
                    tmp_path = tmp.name

                try:
                    # 2. Thực hiện Pipeline Giai đoạn 2 (Bóc tách & Chunking)
                    st.write("Đang phân tích layout và bóc tách chữ...")
                    processor = DocumentProcessor(chunk_size=700, chunk_overlap=150)
                    chunks = processor.run_pipeline(tmp_path)

                    # 3. Thực hiện Pipeline Giai đoạn 3 (Mã hóa & Lưu DB)
                    st.write("Đang mã hóa dữ liệu vào Vector Database...")
                    base_dir = Path(__file__).resolve().parent
                    db_dir = base_dir / "chroma_db"
                    db_manager = ChromaDBManager(persist_directory=str(db_dir))
                    db_manager.build_database(chunks, collection_name="learning_data")
                    
                    status.update(label="Đã nạp kiến thức thành công!", state="complete")
                    st.success("Bây giờ bạn có thể đặt câu hỏi về tài liệu này.")
                    
                    # Quan trọng: Làm mới cache để Bot nhận diện được dữ liệu mới vừa nạp
                    st.cache_resource.clear()
                    
                except Exception as e:
                    st.error(f"Lỗi khi xử lý file: {str(e)}")
                finally:
                    # Dọn dẹp file tạm
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)

    st.divider()
    if st.button("Xóa lịch sử trò chuyện"):
        st.session_state.messages = []
        st.rerun()

# --- KHU VỰC CHAT CHÍNH ---
st.title("Gia Sư AI Thông Thái")
st.info("Hệ thống đã sẵn sàng. Hãy đặt câu hỏi về các bài học, mình sẽ giải thích kèm ví dụ thực tế cho bạn!")

# Quản lý lịch sử tin nhắn trong bộ nhớ phiên (session_state)
if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Chào bạn nha! Mình đã sẵn sàng hỗ trợ. Hôm nay bạn muốn mình giải thích phần kiến thức nào không? 😊"}
    ]

# Hiển thị các tin nhắn cũ trong lịch sử
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Xử lý khi người dùng nhập câu hỏi
if prompt := st.chat_input("Hỏi mình bất cứ điều gì về bài học..."):
    # Hiển thị tin nhắn người dùng
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Bot xử lý và phản hồi
    with st.chat_message("assistant"):
        with st.spinner("Đang tra cứu tài liệu và suy nghĩ ví dụ cho bạn..."):
            try:
                # Lấy instance của Bot
                bot = get_bot()
                response = bot.chat(prompt)
                
                answer = response["answer"]
                
                # Trích xuất thông tin nguồn tham khảo để tăng độ tin cậy
                pages = set()
                for doc in response["context"]:
                    p = doc.metadata.get("page_number")
                    if p: pages.add(str(p))
                
                if pages:
                    answer += f"\n\n---\n **Nguồn tham khảo:** Trang {', '.join(sorted(list(pages)))}"

                # Hiển thị và lưu vào lịch sử
                st.markdown(answer)
                st.session_state.messages.append({"role": "assistant", "content": answer})
                
            except Exception as e:
                st.error(f"Lỗi hệ thống: {str(e)}")
                if "mistral" in str(e).lower():
                    st.warning("Mẹo: Kiểm tra lại MISTRAL_API_KEY trong file .env nhé!")
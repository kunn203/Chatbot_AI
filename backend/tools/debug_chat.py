import os
from dotenv import load_dotenv
from pathlib import Path

from src.database import ChromaDBManager
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from src.llm import LearningAssistantBot

# Load biến môi trường từ file .env
load_dotenv()

def main():
    base_dir = Path(__file__).resolve().parent
    db_dir = base_dir / "chroma_db"

    if not db_dir.exists():
        print("Không tìm thấy ChromaDB. Vui lòng chạy main.py trước để tạo DB.")
        return

    print("Đang khởi động hệ thống...")
    
    # 1. Tải lại cấu hình Embedding
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

    # 2. Kết nối Database
    vector_db = Chroma(
        persist_directory=str(db_dir),
        embedding_function=embeddings,
        collection_name="learning_data"
    )

    # 3. Khởi tạo Bot
    bot = LearningAssistantBot(vector_store=vector_db)

    print("\n" + "="*50)
    print("TRỢ LÝ HỌC TẬP AI ĐÃ SẴN SÀNG!")
    print("Nhập 'quit' hoặc 'exit' để thoát.")
    print("="*50 + "\n")

    # 4. Vòng lặp Chat (CLI Interface)
    while True:
        user_input = input("\nBạn: ")
        if user_input.lower() in ['quit', 'exit']:
            print("Tạm biệt!")
            break
            
        if not user_input.strip():
            continue

        try:
            # Gọi bot xử lý
            result = bot.chat(user_input)
            
            # In câu trả lời
            print(f"\nGia sư AI:\n{result['answer']}")
            
            # In nguồn tài liệu tham khảo (Optional nhưng rất chuyên nghiệp)
            print("\n[Nguồn tham khảo]:")
            for i, doc in enumerate(result['context'], 1):
                page = doc.metadata.get('page_number', 'N/A')
                print(f"  - Đoạn {i} (Trang {page})")
                
        except Exception as e:
            print(f"\nLỗi kết nối: {str(e)}")

if __name__ == "__main__":
    main()
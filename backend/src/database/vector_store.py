import os
import logging
from typing import List
from langchain_core.documents import Document

# Thư viện embedding và vector DB
from langchain_mistralai import MistralAIEmbeddings

from supabase import create_client, Client
from langchain_community.vectorstores import SupabaseVectorStore

logger = logging.getLogger(__name__)

class SupabaseDBManager:
    """
    Class quản lý kết nối và thao tác với Supabase Vector Database.
    """
    def __init__(self):
        # 1. Khởi tạo mô hình Embedding Mistral
        logger.info("Đang tải mô hình MistralAI Embeddings...")
        api_key = os.getenv("MISTRAL_API_KEY")
        self.embeddings = MistralAIEmbeddings(api_key=api_key)
        
        # 2. Khởi tạo Supabase Client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL or SUPABASE_SERVICE_KEY is missing in .env")
            
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
    def get_vector_store(self) -> SupabaseVectorStore:
        return SupabaseVectorStore(
            client=self.supabase,
            embedding=self.embeddings,
            table_name="documents",
            query_name="match_documents"
        )

    def build_database(self, chunks: List[Document]) -> SupabaseVectorStore:
        if not chunks:
            logger.warning("Không có dữ liệu để lưu vào Database.")
            return None

        logger.info(f"Bắt đầu mã hóa {len(chunks)} chunks và lưu vào Supabase pgvector...")
        
        for doc in chunks:
            clean_metadata = {}
            for key, value in doc.metadata.items():
                if isinstance(value, (str, int, float, bool)):
                    clean_metadata[key] = value
                elif isinstance(value, list) and all(isinstance(x, (str, int, float, bool)) for x in value):
                    clean_metadata[key] = value
            doc.metadata = clean_metadata

        vector_db = SupabaseVectorStore.from_documents(
            chunks,
            self.embeddings,
            client=self.supabase,
            table_name="documents",
            query_name="match_documents"
        )
        
        logger.info("Đã xây dựng Vector Database thành công trên Supabase!")
        return vector_db

    def delete_file(self, source_name: str, owner: str) -> bool:
        """
        Xóa toàn bộ chunks của một file cụ thể thuộc về một owner.
        """
        try:
            # Xóa các dòng có chứa {source: ..., owner: ...} trong cột metadata dạng JSONB
            response = self.supabase.table('documents').delete().contains('metadata', {'source': source_name, 'owner': owner}).execute()
            
            # Supabase trả về các rows đã xóa trong response.data
            deleted_count = len(response.data) if hasattr(response, 'data') else 0
            
            # Ghi chú: Nếu bảng không cài đặt trả về row (returning) thì data có thể rỗng, 
            # nhưng execute() thành công vẫn là đã gửi lệnh xóa thành công.
            logger.info(f"Đã gửi lệnh xóa file: {source_name} (Owner: {owner}). Dữ liệu phản hồi: {deleted_count} chunks.")
            return True
        except Exception as e:
            logger.error(f"Lỗi khi xóa file {source_name}: {e}")
            return False
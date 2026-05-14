import logging
from pathlib import Path
from typing import List, Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# Thiết lập Logger để theo dõi quá trình xử lý theo thời gian thực
logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Class chịu trách nhiệm xử lý vòng đời của tài liệu: 
    Load (Tải) -> Clean (Làm sạch) -> Split (Chia nhỏ).
    """

    def __init__(
        self, 
        chunk_size: int = 600, 
        chunk_overlap: int = 100
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Sử dụng RecursiveCharacterTextSplitter để giữ ngữ cảnh tốt nhất
        # DSA Note: Thuật toán này ưu tiên cắt ở các dấu câu (., \n) trước khi cắt ngang từ
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )

    def load_pdf(self, file_path: str) -> List[Document]:
        """
        Bóc tách PDF sử dụng Unstructured với chế độ nhận diện layout.
        """
        path = Path(file_path)
        if not path.exists():
            logger.error(f"File không tồn tại: {file_path}")
            raise FileNotFoundError(f"Không tìm thấy file tại {file_path}")

        logger.info(f"Đang bóc tách file: {path.name}...")
        
        # Sử dụng PyPDFLoader để đọc nhanh nội dung chữ thay vì dùng OCR (tiết kiệm tài nguyên)
        loader = PyPDFLoader(file_path=str(path))
        
        try:
            documents = loader.load()
            logger.info(f"Đã tải xong {len(documents)} elements từ PDF.")
            return documents
        except Exception as e:
            logger.error(f"Lỗi khi bóc tách PDF: {str(e)}")
            return []

    def process_documents(self, documents: List[Document]) -> List[Document]:
        """
        Thực hiện thuật toán chia nhỏ văn bản (Chunking).
        DSA Note: Việc sử dụng overlap giúp giảm thiểu mất mát thông tin tại biên của các vector.
        """
        if not documents:
            return []

        logger.info("Bắt đầu quá trình chia nhỏ văn bản (Chunking)...")
        chunks = self.text_splitter.split_documents(documents)
        logger.info(f"Tạo thành công {len(chunks)} chunks dữ liệu.")
        
        return chunks

    def run_pipeline(self, file_path: str) -> List[Document]:
        """
        Luồng thực thi hoàn chỉnh (End-to-End Ingestion).
        """
        raw_docs = self.load_pdf(file_path)
        final_chunks = self.process_documents(raw_docs)
        return final_chunks
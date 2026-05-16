import os
import logging
import shutil
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from dotenv import load_dotenv

# Import các thành phần nội bộ từ package src đã xây dựng
from src.database.vector_store import SupabaseDBManager
from src.llm.bot import LearningAssistantBot
from src.data_processing.ingestion import DocumentProcessor

# Tải cấu hình API Key
load_dotenv()
logger = logging.getLogger(__name__)

app = FastAPI(title="Gia Sư AI API", description="API phục vụ hệ thống RAG Learning Assistant")

# Cho phép ứng dụng React giao tiếp với API (Cấu hình CORS mở rộng cho Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép mọi tên miền gọi tới (bao gồm Vercel)
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Biến toàn cục lưu trữ Bot (Singleton Pattern)
bot_instance = None

def init_bot():
    global bot_instance
    if bot_instance is None:
        try:
            # Khởi tạo SupabaseDBManager và lấy Vector Store
            db_manager = SupabaseDBManager()
            vector_db = db_manager.get_vector_store()
            
            bot_instance = LearningAssistantBot(vector_store=vector_db)
            logger.info("Khởi tạo RAG Bot với Supabase thành công.")
        except Exception as e:
            logger.error(f"Lỗi khởi tạo Bot: {e}")
            raise e
    return bot_instance

# Models gửi nhận data
class ChatRequest(BaseModel):
    query: str
    currentUser: Optional[str] = None

class DeleteRequest(BaseModel):
    filename: str
    currentUser: str

class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []

@app.on_event("startup")
async def startup_event():
    # Cache lại bot trên Ram lúc server uvicorn bật lên
    init_bot()

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    bot = init_bot()
    if not bot:
        raise HTTPException(status_code=500, detail="Hệ thống AI chưa sẵn sàng.")
    
    try:
        # Sử dụng StreamingResponse để truyền dữ liệu về Frontend từng phần (chunk)
        return StreamingResponse(
            bot.chat_stream(request.query, request.currentUser), 
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Lỗi xử lý chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_endpoint(
    file: UploadFile = File(...),
    currentUser: str = Form(None)
):
    if not currentUser:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    try:
        # 1. Lưu file tạm
        temp_dir = Path("temp_uploads")
        temp_dir.mkdir(exist_ok=True)
        file_path = temp_dir / file.filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Đã lưu file tạm tại {file_path}")
        
        # 2. Xử lý file (Load -> Chunking)
        processor = DocumentProcessor()
        chunks = processor.run_pipeline(str(file_path))
        
        # 3. Gắn nhãn phân quyền (Multi-tenant) và chuẩn hóa tên file (Source)
        for chunk in chunks:
            chunk.metadata["owner"] = currentUser
            chunk.metadata["source"] = file.filename
            
        # 4. Lưu vào Supabase pgvector
        bot = init_bot()
        db_manager = SupabaseDBManager()
        db_manager.build_database(chunks=chunks)
        
        # 5. Dọn dẹp file tạm
        os.remove(file_path)
        
        return {"message": "Tải lên và xử lý thành công!", "filename": file.filename, "chunks_indexed": len(chunks)}
    except Exception as e:
        logger.error(f"Lỗi xử lý file upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete")
async def delete_endpoint(request: DeleteRequest):
    if not request.currentUser:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    try:
        db_manager = SupabaseDBManager()
        success = db_manager.delete_file(source_name=request.filename, owner=request.currentUser)
        
        if success:
            return {"message": "Xóa file thành công"}
        else:
            # File không tồn tại hoặc đã bị xóa
            return {"message": "File không tồn tại trong DB, có thể đã được xóa."}
    except Exception as e:
        logger.error(f"Lỗi khi xóa file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

import os
import logging
from dotenv import load_dotenv

from langchain_mistralai import ChatMistralAI
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_community.vectorstores import SupabaseVectorStore
from supabase.client import Client

class CustomSupabaseRetriever(BaseRetriever):
    supabase_client: Client
    embeddings: object
    owner: str
    k: int = 5

    def _get_relevant_documents(self, query: str, *, run_manager=None):
        embedding = self.embeddings.embed_query(query)
        try:
            res = self.supabase_client.rpc(
                "match_documents",
                {
                    "query_embedding": embedding,
                    "match_count": self.k,
                    "filter": {"owner": self.owner}
                }
            ).execute()
            docs = []
            for r in res.data:
                docs.append(Document(page_content=r["content"], metadata=r["metadata"]))
            return docs
        except Exception as e:
            logger.error(f"Lỗi rpc match_documents: {e}")
            return []

load_dotenv()
logger = logging.getLogger(__name__)

class LearningAssistantBot:
    """
    Class quản lý AI Bot sử dụng Mistral AI và kỹ thuật RAG.
    """
    def __init__(self, vector_store: SupabaseVectorStore):
        self.vector_db = vector_store
        
        # 1. Lấy API Key từ biến môi trường
        self.api_key = os.getenv("MISTRAL_API_KEY")
        if not self.api_key:
            logger.error("Không tìm thấy MISTRAL_API_KEY trong file .env")
            raise ValueError("MISTRAL_API_KEY is missing. Please add it to your .env file.")

        # 2. Khởi tạo mô hình ngôn ngữ Lớn (LLM) - Mistral
        logger.info("Đang khởi tạo Mistral AI Model (mistral-large-latest)...")
        self.llm = ChatMistralAI(
            model="mistral-large-latest",
            api_key=self.api_key,
            temperature=0.3, # Temperature thấp giúp AI trả lời chính xác, bám sát nội dung hơn
        )
        
        # 3. Tạo Prompt Template để cấu trúc câu hỏi cho AI một cách chuẩn mực
        self.prompt = ChatPromptTemplate.from_template(
            '''Bạn là một người bạn đồng hành và là một gia sư AI cực kỳ thân thiện, vui vẻ và tâm lý.
            Nhiệm vụ của bạn là biến những kiến thức khô khan trong tài liệu thành những bài học dễ hiểu nhất. 
            Hãy trả lời câu hỏi của học viên dựa TRÊN thông tin được cung cấp trong ngữ cảnh (Context) dưới đây. 
            Nếu thông tin trong ngữ cảnh không đủ để bạn trả lời chắc chắn, hãy thành thật nói "Tôi không tìm thấy thông tin này trong tài liệu học tập của bạn."
            Tuyệt đối không bịa đặt thông tin.
            Quy tắc:
            1. Ví dụ thực tế (Nếu cần): Mỗi khi giải thích một định nghĩa, quy tắc hoặc khái niệm khó, bạn phải tự sáng tạo ra một ví dụ thực tế trong đời sống thường ngày để minh họa cho khái niệm đó.
            2. Tone giọng: Luôn xưng hô là 'mình' và gọi người dùng là 'bạn'. Bắt đầu câu trả lời bằng một lời chào hoặc một câu đệm thân thiện (vd: 'Chào bạn nha!', 'Câu hỏi này thú vị quá!', 'Chuyện nhỏ, để mình giải thích nhé!').
            3. Trung thực: Chỉ dùng thông tin từ Ngữ Cảnh ở trên để giải thích kiến thức. Nếu tài liệu không có, hãy nhẹ nhàng nói: 'Tiếc quá, trong tài liệu hiện tại mình không thấy phần này, bạn có muốn mình tìm hiểu thêm từ bên ngoài không?'.
            4. Tóm tắt: Nếu câu hỏi là tóm tắt, hãy tóm tắt lại nội dung của tài liệu chi tiết nhất có thể.
            5. Công thức Toán học: BẮT BUỘC phải viết mọi công thức toán học, ký hiệu toán học bằng cú pháp LaTeX. Công thức inline phải bọc trong cặp dấu đô-la đơn $...$ (ví dụ: $P(X=x) = \\frac{{1}}{{n}}$). Công thức dạng block (trên dòng riêng) phải bọc trong cặp dấu đô-la kép $$...$$ (ví dụ: $$E(X) = \\sum_{{i=1}}^{{n}} x_i \\cdot P(x_i)$$). TUYỆT ĐỐI KHÔNG được viết công thức toán dưới dạng text thuần.
            6. Định dạng Markdown: Sử dụng Markdown cho các heading, bold, italic, danh sách để câu trả lời rõ ràng và dễ đọc.
            Context:
            {context}

            Question: {input}

            Answer:'''
        )
        
        # 4. Liên kết các thành phần thành chuỗi xử lý tài liệu (Document Chain)
        self.document_chain = create_stuff_documents_chain(self.llm, self.prompt)

    def chat(self, query: str, current_user: str = None) -> dict:
        """
        Nhận câu hỏi từ người dùng, thực hiện RAG context retrieval và sinh câu trả lời bằng Mistral AI.
        """
        logger.info(f"Đang phân tích và xử lý câu hỏi: '{query}' từ user: {current_user}...")
        
        # Nếu là Guest (chưa đăng nhập), bỏ qua RAG để bảo mật dữ liệu và tránh lỗi DB rỗng
        if not current_user:
            logger.info("Chế độ Guest: Sử dụng LLM trực tiếp, không dùng RAG.")
            prompt_text = f"Bạn là một trợ lý AI thông minh. Hãy trả lời câu hỏi sau một cách ngắn gọn và thân thiện: {query}"
            response_text = self.llm.invoke(prompt_text)
            return {
                "answer": response_text.content.strip() if hasattr(response_text, 'content') else str(response_text).strip(),
                "context": []
            }
            
        # Khởi tạo Retriever thủ công để tránh lỗi thư viện Langchain
        retriever = CustomSupabaseRetriever(
            supabase_client=self.vector_db.client,
            embeddings=self.vector_db.embedding,
            owner=current_user,
            k=5
        )
        
        # Liên kết chain
        retrieval_chain = create_retrieval_chain(retriever, self.document_chain)
        
        try:
            # Gọi chain AI sinh kết quả
            response = retrieval_chain.invoke({"input": query})
            return {
                "answer": response["answer"],
                "context": response["context"]
            }
        except Exception as e:
            logger.error(f"Lỗi khi query ChromaDB: {e}")
            # Fallback nếu DB lỗi (ví dụ DB rỗng)
            response_text = self.llm.invoke(f"Bạn là một trợ lý AI thông minh. Hãy trả lời câu hỏi sau một cách ngắn gọn: {query}")
            return {
                "answer": response_text.content.strip() if hasattr(response_text, 'content') else str(response_text).strip(),
                "context": []
            }

    def chat_stream(self, query: str, current_user: str = None):
        """
        Nhận câu hỏi từ người dùng, thực hiện RAG context retrieval và trả về luồng dữ liệu (Stream) dạng văn bản.
        """
        logger.info(f"Đang xử lý Streaming câu hỏi: '{query}' từ user: {current_user}...")
        
        # Nếu là Guest (chưa đăng nhập), bỏ qua RAG để bảo mật dữ liệu và tránh lỗi DB rỗng
        if not current_user:
            logger.info("Chế độ Guest: Sử dụng LLM trực tiếp, không dùng RAG (Streaming).")
            prompt_text = f"Bạn là một trợ lý AI thông minh. Hãy trả lời câu hỏi sau một cách ngắn gọn và thân thiện: {query}"
            for chunk in self.llm.stream(prompt_text):
                if hasattr(chunk, 'content') and chunk.content:
                    yield chunk.content
            return
            
        # Khởi tạo Retriever thủ công để tránh lỗi thư viện Langchain
        retriever = CustomSupabaseRetriever(
            supabase_client=self.vector_db.client,
            embeddings=self.vector_db.embedding,
            owner=current_user,
            k=5
        )
        
        # Liên kết chain
        retrieval_chain = create_retrieval_chain(retriever, self.document_chain)
        
        try:
            # Gọi chain AI sinh kết quả dạng stream
            for chunk in retrieval_chain.stream({"input": query}):
                # Trong create_retrieval_chain, kết quả sinh ra nằm trong key 'answer'
                if "answer" in chunk and chunk["answer"]:
                    yield chunk["answer"]
        except Exception as e:
            logger.error(f"Lỗi khi query ChromaDB (Streaming): {e}")
            # Fallback nếu DB lỗi (ví dụ DB rỗng)
            fallback_prompt = f"Bạn là một trợ lý AI thông minh. Hãy trả lời câu hỏi sau một cách ngắn gọn: {query}"
            for chunk in self.llm.stream(fallback_prompt):
                if hasattr(chunk, 'content') and chunk.content:
                    yield chunk.content

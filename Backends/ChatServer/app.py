from flask import Flask, request, jsonify
from langchain_community.document_loaders import TextLoader
from langchain.indexes import VectorstoreIndexCreator
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import FAISS
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import os
import re


# Initialize Flask app
app = Flask(_name_)
CORS(app)

# Load environment variables
load_dotenv()
gemini_api_key = os.getenv("GEMINI_APIKEY")

# Configure Google Generative AI client
genai.configure(api_key=gemini_api_key)
gemini_model = genai.GenerativeModel("gemini-1.5-flash")

# Global variables
vector_store = None
embedding_model = HuggingFaceEmbeddings(model_name='all-MiniLM-L6-v2')
faiss_path = "faiss_index"
text_file_path = 'data.txt'

# Initialize vector store
def initialize_vector_store():
    global vector_store

    if os.path.exists(faiss_path):
        try:
            vector_store = FAISS.load_local(faiss_path, embedding_model, allow_dangerous_deserialization=True)
        except Exception as e:
            print("Error loading FAISS index:", e)
            vector_store = None
    elif os.path.exists(text_file_path):
        loaders = [TextLoader(text_file_path)]
        index = VectorstoreIndexCreator(
            embedding=embedding_model, 
            vectorstore_cls=FAISS,
            text_splitter=RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
        ).from_loaders(loaders)

        vector_store = index.vectorstore
        vector_store.save_local(faiss_path)

# Initialize on startup
initialize_vector_store()

# Route: Query endpoint
@app.route('/query', methods=['POST'])
def query():
    global vector_store
    if vector_store is None:
        return jsonify({"error": "Vector store not initialized"}), 500

    data = request.json
    if 'question' not in data:
        return jsonify({"error": "No question found in the request"}), 400

    query = data['question']
    try:
        results = vector_store.similarity_search(query, k=5)
        context = "\n".join([doc.page_content for doc in results])
        augmented_query = f"Context: {context}\n\nQuestion: {query}"
        response = gemini_model.generate_content(augmented_query)
        return jsonify({"response": response.text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Route: Add new text
@app.route('/add', methods=['POST'])
def add_data():
    global vector_store

    data = request.json
    if 'text' not in data:
        return jsonify({"error": "No text found in the request"}), 400

    text_to_add = data['text'].strip()
    cleaned_text = re.sub(r'[^\x20-\x7E]', '', text_to_add)

    if not cleaned_text:
        return jsonify({"error": "No valid text to add"}), 400

    try:
        # Append to file
        with open(text_file_path, 'a') as f:
            f.write(cleaned_text + '\n')

        # Split & embed new text only
        splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
        new_chunks = splitter.split_text(cleaned_text)
        if not vector_store:
            vector_store = FAISS.from_texts(new_chunks, embedding_model)
        else:
            vector_store.add_texts(new_chunks)

        # Save updated FAISS to disk
        vector_store.save_local(faiss_path)

        return jsonify({"message": "Text added and indexed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run the Flask app
if _name_ == "_main_":
    app.run(host="0.0.0.0", port=5001)

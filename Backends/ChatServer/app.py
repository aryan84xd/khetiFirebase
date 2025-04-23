from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import os
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import json

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "https://khetifirebase-1.onrender.com"])

# Load environment variables
load_dotenv()
gemini_api_key = os.getenv("GEMINI_APIKEY")

# Configure Google Generative AI client
genai.configure(api_key=gemini_api_key)
gemini_model = genai.GenerativeModel("gemini-1.5-flash")

# Global variables
vectorizer = None
document_vectors = None
documents = []
index_file = "tfidf_index.pkl"
text_file_path = 'data.txt'

# Initialize the TF-IDF vectorizer and document store
def initialize_vectorizer():
    global vectorizer, document_vectors, documents
    
    # Create data.txt if it doesn't exist
    if not os.path.exists(text_file_path):
        with open(text_file_path, 'w') as f:
            f.write("This is initial data.\n")
        print(f"Created {text_file_path} with initial data")

    if os.path.exists(index_file):
        try:
            # Load the saved index
            with open(index_file, 'rb') as f:
                saved_data = pickle.load(f)
                vectorizer = saved_data['vectorizer']
                document_vectors = saved_data['document_vectors']
                documents = saved_data['documents']
            print("TF-IDF index loaded successfully.")
        except Exception as e:
            print(f"Error loading TF-IDF index: {e}")
            create_new_index()
    else:
        create_new_index()

def create_new_index():
    global vectorizer, document_vectors, documents
    try:
        # Check if the text file has content
        if os.path.getsize(text_file_path) > 0:
            print("Creating new index from existing text file")
            
            with open(text_file_path, 'r', encoding='utf-8', errors='replace') as f:
                text_content = f.read()
            
            if len(text_content.strip()) == 0:
                print("Text file is empty after stripping whitespace.")
                initialize_with_dummy_data()
                return
                
            # IMPROVED: Process one-liners from the text file
            chunks = [line.strip() for line in text_content.split('\n') if line.strip()]
            
            if chunks:
                print(f"Created {len(chunks)} chunks from text file")
                documents = chunks
                
                # IMPROVED: Configure TF-IDF for short texts
                vectorizer = TfidfVectorizer(
                    stop_words='english',
                    ngram_range=(1, 2),  # Include bigrams
                    min_df=1,
                    max_df=0.9,
                    sublinear_tf=True  # Apply sublinear tf scaling
                )
                document_vectors = vectorizer.fit_transform(documents)
                
                # Save the index
                save_index()
                print("TF-IDF index created and saved.")
            else:
                print("No chunks extracted from text file.")
                initialize_with_dummy_data()
        else:
            print("Text file is empty.")
            initialize_with_dummy_data()
    except Exception as e:
        import traceback
        print(f"Error creating new index: {e}")
        print(traceback.format_exc())
        initialize_with_dummy_data()

def initialize_with_dummy_data():
    global vectorizer, document_vectors, documents
    print("Initializing with dummy data")
    dummy_texts = ["This is a sample document to initialize the vector store."]
    try:
        documents = dummy_texts
        vectorizer = TfidfVectorizer(
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.9,
            sublinear_tf=True
        )
        document_vectors = vectorizer.fit_transform(documents)
        
        # Save to text file
        with open(text_file_path, 'w') as f:
            f.write(dummy_texts[0] + "\n")
        
        # Save index
        save_index()
        print("TF-IDF index initialized with dummy data.")
    except Exception as e:
        import traceback
        print(f"Failed to initialize with dummy data: {e}")
        print(traceback.format_exc())
        vectorizer = None
        document_vectors = None
        documents = []

def save_index():
    """Save the current index to disk"""
    with open(index_file, 'wb') as f:
        pickle.dump({
            'vectorizer': vectorizer,
            'document_vectors': document_vectors,
            'documents': documents
        }, f)

# IMPROVED: Enhanced similarity search
def find_relevant_documents(user_query, top_k=5, similarity_threshold=0.02):
    """Find the most relevant documents for a given query with improved handling of short texts"""
    
    query_vector = vectorizer.transform([user_query])
    
    # Calculate similarities with all documents
    similarities = cosine_similarity(query_vector, document_vectors).flatten()
    
    # Get top k most similar documents
    top_indices = similarities.argsort()[:-top_k-1:-1]
    
    relevant_docs = []
    similarity_scores = []
    
    for idx in top_indices:
        if similarities[idx] > similarity_threshold:  # Lower threshold for short texts
            relevant_docs.append(documents[idx])
            similarity_scores.append(similarities[idx])
    
    return relevant_docs, similarity_scores

# Route: Query endpoint
@app.route('/query', methods=['POST'])
def query():
    global vectorizer, document_vectors, documents
    
    if vectorizer is None or document_vectors is None:
        try:
            initialize_vectorizer()
        except Exception as e:
            print(f"Failed to initialize vectorizer: {e}")
            return jsonify({"response": "Sorry, I'm having trouble accessing the knowledge base."}), 200
        
        if vectorizer is None or document_vectors is None:
            return jsonify({"response": "I'm unable to access the knowledge base right now."}), 200

    data = request.json
    if 'question' not in data:
        return jsonify({"error": "No question found in the request"}), 400

    user_query = data['question']
    try:
        # Simple response for empty index or very short queries
        if len(user_query.strip()) < 3:
            return jsonify({"response": "Please provide a more detailed question."}), 200
        
        # Try to safely get similar documents
        try:
            # IMPROVED: Get relevant docs with scores using the enhanced function
            relevant_docs, similarity_scores = find_relevant_documents(
                user_query, 
                top_k=5,  # Retrieve more potentially relevant docs
                similarity_threshold=0.02  # Lower threshold for one-liners
            )
            
            print(f"Found {len(relevant_docs)} relevant documents")
            
            # IMPROVED: Prepare more informative context with similarity scores
            if relevant_docs:
                context_items = []
                for i, (doc, score) in enumerate(zip(relevant_docs, similarity_scores)):
                    context_items.append(f"[{i+1}] {doc} (relevance: {score:.3f})")
                context = "\n".join(context_items)
            else:
                context = "No relevant information found in the knowledge base."
        
        except Exception as search_error:
            import traceback
            print(f"Search error: {search_error}")
            print(traceback.format_exc())
            context = "I couldn't search through the available information effectively."
        
        # IMPROVED: Better prompt for handling one-liner information
        prompt = f"""
        Question: {user_query}
        
        Information from knowledge base (ordered by relevance):
        {context}
        
        Instructions:
        1. Answer the question based on the information provided above.
        2. If multiple pieces of information are relevant, synthesize them into a coherent answer.
        3. If the information is sparse or partial, do your best to provide a helpful response.
        4. If no information is relevant, clearly state that you don't have sufficient information to answer accurately.
        5. Keep your response concise and focused on the question.
        """
        
        # Generate response with Gemini
        response = gemini_model.generate_content(prompt)
        
        return jsonify({"response": response.text}), 200
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error during query processing: {e}")
        print(error_trace)
        return jsonify({"response": "I encountered an error while processing your question. Please try again."}), 200


# Route: Add new text
@app.route('/add', methods=['POST'])
def add_data():
    global vectorizer, document_vectors, documents
    
    data = request.json
    if 'text' not in data:
        return jsonify({"error": "No text found in the request"}), 400

    text_to_add = data['text'].strip()
    # Clean text of non-ASCII characters
    cleaned_text = re.sub(r'[^\x00-\x7F]+', ' ', text_to_add)

    if not cleaned_text:
        return jsonify({"error": "No valid text to add"}), 400

    try:
        # Ensure vectorizer is initialized
        if vectorizer is None or document_vectors is None:
            initialize_vectorizer()
            if vectorizer is None or document_vectors is None:
                return jsonify({"error": "Failed to initialize vectorizer"}), 500
        
        # IMPROVED: Process and add each line separately
        new_lines = [line.strip() for line in cleaned_text.split('\n') if line.strip()]
        
        # Append to file
        with open(text_file_path, 'a') as f:
            for line in new_lines:
                f.write(line + "\n")
        
        print(f"Added {len(new_lines)} new lines to file")

        # Add new documents
        documents.extend(new_lines)
        
        # Update the document vectors with the same improved parameters
        vectorizer = TfidfVectorizer(
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.9,
            sublinear_tf=True
        )
        document_vectors = vectorizer.fit_transform(documents)
        
        # Save the updated index
        save_index()
        print(f"Added {len(new_lines)} chunks to TF-IDF index")

        return jsonify({"message": f"Successfully added {len(new_lines)} items to knowledge base"}), 200
    except Exception as e:
        import traceback
        print(f"Error adding data: {e}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

# Route: Get all knowledge base entries
@app.route('/list', methods=['GET'])
def list_knowledge():
    global documents
    
    if not documents:
        try:
            initialize_vectorizer()
        except Exception as e:
            print(f"Failed to initialize vectorizer: {e}")
            return jsonify({"entries": []}), 200
    
    return jsonify({"entries": documents}), 200

# Run the Flask app
if __name__ == "__main__":
    # Initialize vectorizer at startup
    initialize_vectorizer()
    app.run(debug=True, host="0.0.0.0", port=5001)
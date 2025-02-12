import os
import json
import sqlite3
from pathlib import Path
from PIL import Image, ImageDraw
from flask import Flask, render_template, send_file, jsonify

'''
- `get_db_connection()` establishes a connection with the SQLite database.
- `init_db()` creates the necessary tables (`root_dirs` and `images`) if they don't exist.
- `/image_collections` endpoint returns all image collections from the `root_dirs` table.
- `/images/<int:collection_id>` lists images belonging to a specified collection.
- `/image/<path:filename>` retrieves the image file path from the database and serves the image.
- The application is initialized with `init_db()` to ensure tables are set up before the server runs.
#     CREATE TABLE IF NOT EXISTS root_dirs (
#         id INTEGER PRIMARY KEY AUTOINCREMENT,
#         root_dir TEXT NOT NULL

#     CREATE TABLE IF NOT EXISTS images (
#         id INTEGER PRIMARY KEY AUTOINCREMENT,
#         root_dir_id INTEGER,
#         image_full TEXT NOT NULL,
#         image_name TEXT NOT NULL,
#         labels JSON,
#         FOREIGN KEY (root_dir_id) REFERENCES root_dirs(id)
#
'''

app = Flask(__name__)

def get_db_connection():
    conn = sqlite3.connect('images.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inspect/<image>')
def inspect(image):
    return render_template('inspect.html', image=image)

@app.route('/image_collections')
@app.route('/image_collections')
def get_image_collections():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM root_dirs')
    collections = cursor.fetchall()

    # Add cover_image to each collection
    res = [dict(row) for row in collections] 
    for row in res:
        collection_id = row['id']
        cursor.execute('SELECT image_name FROM images WHERE root_dir_id = ? LIMIT 1', (collection_id,))
        path = cursor.fetchone()
        if id:
            row['cover_image'] = path[0]
        else:
            raise LookupError(f"could not find any images in root_dir with id {collection_id}")

    conn.close()
    return jsonify(res)

@app.route('/images/<int:collection_id>')
def list_images(collection_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT image_name FROM images WHERE root_dir_id = ?', (collection_id,))
    images = cursor.fetchall()
    conn.close()
    return jsonify([row['image_name'] for row in images])

@app.route('/image/<path:filename>')
def get_image(filename):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT image_full FROM images WHERE image_name = ?', (filename,))
    result = cursor.fetchone()
    if not result:
        return "Image not found", 404

    image_full_path = result['image_full']
    assert os.path.exists(image_full_path), f"could not find {image_full_path}"

    return send_file(image_full_path)

@app.route('/labels/<path:filename>')
def get_labels(filename):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT labels FROM images WHERE image_name = ?', (filename,))
    result = cursor.fetchone()
    if not result or not result['labels']:
        return jsonify([])

    labels = json.loads(result['labels'])
    print(labels)
    print(type(jsonify(labels)), jsonify(labels))
    return jsonify(labels)

if __name__ == '__main__':
    app.run(debug=True, port=8000)

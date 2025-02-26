import os
import re
import json
import sqlite3
from pathlib import Path
from PIL import Image, ImageDraw
from flask import Flask, render_template, request, send_file, jsonify, Response, abort
from ultralytics import YOLO

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
        if id: row['cover_image'] = path[0]
        else: raise LookupError(f"could not find any images in root_dir with id {collection_id}")
    conn.close()
    print(jsonify(res))
    return jsonify(res)

@app.route('/image_id/<path:filename>')
def get_image_id(filename):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Fetch the current image and its order
    cursor.execute('SELECT id FROM images WHERE image_name = ?', (filename,))
    current = cursor.fetchone()
    if not current:
        return "Image not found", 404
    current_id = current['id']
    return jsonify(current_id)

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

@app.route('/label_classes/<path:filename>')
def get_label_classes(filename):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT r.label_classes 
        FROM root_dirs AS r 
        JOIN images AS i ON r.id = i.root_dir_id 
        WHERE i.image_name = ?
    ''', (filename,))
    result = cursor.fetchone()
    if not result or not result['label_classes']:
        return jsonify({})
    label_classes = {k:c for c,k in enumerate(result['label_classes'].split(" "))}
    return jsonify(label_classes)

@app.route('/labels/<path:filename>')
def get_labels(filename):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT labels FROM images WHERE image_name = ?', (filename,))
    result = cursor.fetchone()
    if not result or not result['labels']:
        return jsonify([])
    labels = json.loads(result['labels'])
    return jsonify(labels)

@app.route('/update_labels', methods=['post'])
def add_labels():
    data = request.get_json()
    if not isinstance(data, dict) or 'filename' not in data or 'labels' not in data:
        return "invalid input data", 400
    filename = data['filename']
    labels = data['labels']
    if not isinstance(labels, list):
        return "invalid label data", 400

    # remove duplicate labels based on 'class' and 'coordinates'
    unique_labels = {}
    for label in labels:
        label_class = label.get('class')
        coordinates = tuple(label.get('coordinates', []))
        key = (label_class, coordinates)
        if key not in unique_labels:
            unique_labels[key] = label
    print(f"adding {len(list(unique_labels.values()))} labels, duplicates: {len(labels)-len(list(unique_labels.values()))}")

    labels = list(unique_labels.values())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('update images set labels = ? where image_name = ?', (json.dumps(labels), filename))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "labels added successfully"})

@app.route('/delete_labels/<path:filename>')
def delete_labels(filename):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE images SET labels = ? WHERE image_name = ?', (json.dumps([]), filename))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": "Labels removed successfully"})

@app.route('/predict/<path:filename>')
def predict_image(filename):
    # Define the path to the YOLO model
    model_path = Path(__file__).parent / "models" / "feb16.pt"
    model = YOLO(model_path)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT image_full FROM images WHERE image_name = ?', (filename,))
    result = cursor.fetchone()
    conn.close()
    if not result:
        return "Image not found", 404
    image_full_path = result['image_full']
    if not os.path.exists(image_full_path):
        return "Image file does not exist", 404
    preds = [p.boxes for p in model.predict(image_full_path)]
    res = []
    for p in model.predict(image_full_path):
        for b in p.boxes:
            for (_cls,_conf,_xyxy) in zip(b.cls.T.tolist(), b.conf.T.tolist(), b.xywhn.tolist()):
                res.append({"class": _cls, "conf": _conf, "coordinates": _xyxy})
    return jsonify(res)

VIDEO_PATH = Path("/home/newton/repo/Football-Analysis-using-YOLO/output_videos")

@app.route('/video')
def video():
    return render_template('video.html')

@app.route('/video/<path:filename>')
def stream_video(filename):
    video_path = os.path.join(VIDEO_PATH, filename)
    if not os.path.exists(video_path):
        abort(404, description="Video file does not exist")
    return send_file(video_path, mimetype='video/mp4')

@app.route('/videos')
def list_videos():
    # List all video files in the VIDEO_DIR
    videos = []
    for filename in os.listdir(VIDEO_PATH):
        if filename.endswith(('.mp4', '.webm', '.ogg')):  # Add supported video formats
            videos.append({
                'title': os.path.splitext(filename)[0],
                'filename': str(Path(filename).name),
                'thumbnailpath': f'/thumbnails/{os.path.splitext(filename)[0]}.jpg'  # assuming thumbnails are named similarly
            })
    return jsonify({"videos": videos})

if __name__ == '__main__':
    app.run(debug=True, port=8000)


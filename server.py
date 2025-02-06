from flask import Flask, render_template, send_file, jsonify
import os
import json
from pathlib import Path

app = Flask(__name__)

# configuration
images_dir = '/home/newton/repo/Football-Analysis-using-YOLO/data/football-players-detection-1/data/train/images'
labels_dir = '/home/newton/repo/Football-Analysis-using-YOLO/data/football-players-detection-1/data/train/labels'
class_names = ['ball', 'keeper', 'player', 'ref']
class_colors = {'ball': '#ff0000', 'default': '#00ff00'}  # red for ball, green for others

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/images')
def list_images():
    images = [f for f in os.listdir(images_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    return jsonify(images)

@app.route('/image/<path:filename>')
def get_image(filename):
    path = os.path.join(images_dir, filename)
    assert os.path.exists(path), f"could not find {path}"

    return send_file(os.path.join(images_dir, filename))

@app.route('/labels/<path:filename>')
def get_labels(filename):
    label_path = os.path.join(labels_dir, os.path.splitext(filename)[0] + '.txt')
    if not os.path.exists(label_path):
        return jsonify([])

    with open(label_path, 'r') as f:
        labels = [line.strip().split() for line in f.readlines()]

    formatted = []
    for label in labels:
        class_id = int(label[0])
        formatted.append({
            'class': class_names[class_id],
            'coordinates': [float(x) for x in label[1:]]
        })
    return jsonify(formatted)

if __name__ == '__main__':
    app.run(debug=True, port=8000)


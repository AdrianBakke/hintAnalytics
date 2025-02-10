from flask import Flask, render_template, send_file, jsonify
import os
import json
from pathlib import Path
from PIL import Image, ImageDraw

app = Flask(__name__)

# configuration
images_dir = '/home/newton/repo/Football-Analysis-using-YOLO/data/football-players-detection-1/data/train/images'
labels_dir = '/home/newton/repo/Football-Analysis-using-YOLO/data/football-players-detection-1/data/train/labels'
class_names = ['ball', 'keeper', 'player', 'ref']
class_colors = {'ball': '#ff0000', 'default': '#00ff00'}  # red for ball, green for others

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inspect/<image>')
def insepct(image):
    return render_template('inspect.html', image=image)

@app.route('/images')
def list_images():
    images = [f for f in os.listdir(images_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    return jsonify(images)

@app.route('/image/<path:filename>')
def get_image(filename) :
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

@app.route('/draw_labels/<path:filename>')
def draw_labels(filename):
    # Load the image
    image_path = os.path.join(images_dir, filename)
    if not os.path.exists(image_path):
        return "Image not found", 404

    image = Image.open(image_path)
    draw = ImageDraw.Draw(image)
    

    # Load labels
    label_path = os.path.join(labels_dir, os.path.splitext(filename)[0] + '.txt')
    if not os.path.exists(label_path):
        return send_file(image_path)  # return the original image if no labels

    with open(label_path, 'r') as f:
        labels = [line.strip().split() for line in f.readlines()]

    # Draw bounding boxes on the image
    for label in labels:
        class_id = int(label[0])
        coords = [float(x) for x in label[1:]]

        # Assuming the coordinates are in the format [center_x, center_y, width, height] (normalized)
        img_width, img_height = image.size
        center_x, center_y, width, height = coords
        center_x *= img_width
        center_y *= img_height
        width *= img_width
        height *= img_height

        # Calculate box corners
        top_left_x = center_x - width / 2
        top_left_y = center_y - height / 2
        bottom_right_x = center_x + width / 2
        bottom_right_y = center_y + height / 2

        # Get color for the class
        color = class_colors.get(class_names[class_id], class_colors['default'])

        # Draw rectangle
        draw.rectangle([top_left_x, top_left_y, bottom_right_x, bottom_right_y], outline=color, width=2)

    # Instead of saving the image to a file, you can send it directly from memory
    # This avoids unnecessary file I/O and potential race conditions with concurrent requests
    from io import BytesIO
    img_io = BytesIO()
    image.save(img_io, 'PNG')
    img_io.seek(0)

    return send_file(img_io, mimetype='image/png')


if __name__ == '__main__':
    app.run(debug=True, port=8000)



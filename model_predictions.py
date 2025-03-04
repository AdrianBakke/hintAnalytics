import sqlite3
import json
from pathlib import Path
import argparse
from ultralytics import YOLO
from datetime import datetime

def create_db_connection(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute('''CREATE TABLE IF NOT EXISTS model_predictions
             (id INTEGER PRIMARY KEY AUTOINCREMENT,
              model TEXT NOT NULL,
              file TEXT NOT NULL,
              base_path TEXT NOT NULL,
              predictions JSON,
              loss REAL,
              timestamp DATETIME);''')
    return conn

def log_prediction(conn, model, file, image_path, predictions, loss):
    conn.execute('''INSERT INTO model_predictions 
                 (model, file, base_path, predictions, loss, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?)''',
                 (model, file, str(image_path), json.dumps(predictions), loss, datetime.now()))
    conn.commit()

def calculate_iou(box1, box2):
    """Calculate Intersection over Union for normalized xywh boxes"""
    # Convert boxes to xyxy format
    b1_x1, b1_y1 = box1[0] - box1[2]/2, box1[1] - box1[3]/2
    b1_x2, b1_y2 = box1[0] + box1[2]/2, box1[1] + box1[3]/2
    b2_x1, b2_y1 = box2[0] - box2[2]/2, box2[1] - box2[3]/2
    b2_x2, b2_y2 = box2[0] + box2[2]/2, box2[1] + box2[3]/2

    # Intersection area
    inter_x1 = max(b1_x1, b2_x1)
    inter_y1 = max(b1_y1, b2_y1)
    inter_x2 = min(b1_x2, b2_x2)
    inter_y2 = min(b1_y2, b2_y2)
    inter_area = max(inter_x2 - inter_x1, 0) * max(inter_y2 - inter_y1, 0)

    # Union area
    b1_area = box1[2] * box1[3]
    b2_area = box2[2] * box2[3]
    union_area = b1_area + b2_area - inter_area
    return inter_area / union_area if union_area > 0 else 0.0

def load_ground_truth(label_path, model_names):
    """Load YOLO format ground truth labels"""
    if not label_path.exists():
        return []
    with open(label_path, 'r') as f:
        return [{
            'class': model_names[int(line.split()[0])],
            'bbox': list(map(float, line.split()[1:5]))
        } for line in f.read().splitlines()]

def calculate_metrics(predictions, ground_truth):
    """Calculate precision, recall, avg_iou, and class_accuracy"""
    tp, fp, iou_sum = 0, 0, 0.0
    used_gt = set()
    for pred in predictions:
        best_iou, best_gt_idx = 0.0, -1
        for gt_idx, gt in enumerate(ground_truth):
            if gt_idx in used_gt:
                continue
            iou = calculate_iou(pred['coordinates'], gt['coordinates'])
            if iou > best_iou and pred['class'] == gt['class']:
                best_iou = iou
                best_gt_idx = gt_idx
        if best_iou > 0.5:  # IoU threshold
            tp += 1
            used_gt.add(best_gt_idx)
            iou_sum += best_iou
        else:
            fp += 1
    fn = len(ground_truth) - len(used_gt)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / len(ground_truth) if ground_truth else 0.0
    avg_iou = iou_sum / tp if tp > 0 else 0.0
    class_acc = sum(1 for gt in ground_truth if any(p['class'] == gt['class'] for p in predictions)) / len(ground_truth) if ground_truth else 0.0
    return precision, recall, avg_iou, class_acc

def process_images(model, input_dirs, conn):
    for input_dir in input_dirs:
        image_paths = [p for p in Path(input_dir).rglob('*') 
                      if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}]

        for image_path in image_paths:
            # Get predictions
            results = model.predict(image_path)
            boxes = results[0].boxes
            predictions = [{
                'class': model.names[cls.item()],
                'conf': conf.item(),
                'coordinates': box.tolist()
            } for cls, conf, box in zip(boxes.cls, boxes.conf, boxes.xywhn)]

            # Load ground truth
            label_path = image_path.with_suffix('.txt')
            ground_truth = load_ground_truth(label_path, model.names)

            # Calculate metrics-based loss
            if ground_truth:
                precision, recall, avg_iou, class_acc = calculate_metrics(predictions, ground_truth)
                # Composite loss (weighted combination)
                loss = (1.0 - avg_iou) + (1.0 - precision) + (1.0 - recall) + (1.0 - class_acc)
            else:
                # Fallback to confidence-based loss if no ground truth
                confidences = [p['conf'] for p in predictions]
                loss = 1 - (sum(confidences)/len(confidences)) if confidences else 1.0
            log_prediction(conn, "FEB28_N_1536_v5_T2_v1", image_path.name, "/home/newton/repo/Football-Analysis-using-YOLO/data/football-players-detection-1", predictions, loss)

if __name__ == "__main__":
    model_path = "/home/newton/repo/Football-Analysis-using-YOLO/runs/detect/FEB28_N_1536_v5_T2_v1/weights/best.pt"

    conn = create_db_connection("images.db")
    dir_path = "/home/newton/repo/Football-Analysis-using-YOLO/data/football-players-detection-1/data"
    model = YOLO(model_path)

    try:
        # process_images(model, args.input_dirs, conn)
        process_images(model, [dir_path], conn)
    finally:
        conn.close()

import sqlite3
import json
from pathlib import Path
import argparse
from ultralytics import YOLO
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

path: Path = Path(__file__).parent.parent

def create_db_connection(db_path: str) -> sqlite3.Connection:
    conn: sqlite3.Connection = sqlite3.connect(db_path)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS model_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model TEXT NOT NULL,
            file TEXT NOT NULL,
            base_path TEXT NOT NULL,
            predictions JSON,
            loss REAL,
            timestamp DATETIME,
            UNIQUE(model, file)
        );
    ''')
    return conn

def log_prediction(conn: sqlite3.Connection, model_name: str, file: str, image_base_path: Path, predictions: List[Dict[str, Any]], loss: float) -> None:
    conn.execute('''INSERT OR IGNORE INTO model_predictions 
                 (model, file, base_path, predictions, loss, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?)''',
                 (model_name, file, str(image_base_path), json.dumps(predictions), loss, datetime.now()))
    conn.commit()

def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """Calculate Intersection over Union for normalized xywh boxes"""
    # Convert boxes to xyxy format
    b1_x1, b1_y1 = box1[0] - box1[2]/2, box1[1] - box1[3]/2
    b1_x2, b1_y2 = box1[0] + box1[2]/2, box1[1] + box1[3]/2
    b2_x1, b2_y1 = box2[0] - box2[2]/2, box2[1] - box2[3]/2
    b2_x2, b2_y2 = box2[0] + box2[2]/2, box2[1] + box2[3]/2

    # Intersection area
    inter_x1: float = max(b1_x1, b2_x1)
    inter_y1: float = max(b1_y1, b2_y1)
    inter_x2: float = min(b1_x2, b2_x2)
    inter_y2: float = min(b1_y2, b2_y2)
    inter_area: float = max(inter_x2 - inter_x1, 0) * max(inter_y2 - inter_y1, 0)

    # Union area
    b1_area: float = box1[2] * box1[3]
    b2_area: float = box2[2] * box2[3]
    union_area: float = b1_area + b2_area - inter_area
    return inter_area / union_area if union_area > 0 else 0.0

def load_ground_truth(label_path: Path) -> List[Dict[str, Any]]:
    """Load YOLO format ground truth labels"""
    if not label_path.exists():
        return []
    with open(label_path, 'r') as f:
        return [{
            'class': int(line.split()[0]),
            'bbox': list(map(float, line.split()[1:5]))
        } for line in f.read().splitlines()]

def calculate_metrics(predictions: List[Dict[str, Any]], ground_truth: List[Dict[str, Any]]) -> Tuple[float, float, float, float]:
    """Calculate precision, recall, avg_iou, and class_accuracy"""
    tp: int = 0
    fp: int = 0
    iou_sum: float = 0.0
    used_gt: set = set()
    for pred in predictions:
        best_iou: float = 0.0
        best_gt_idx: int = -1
        for gt_idx, gt in enumerate(ground_truth):
            if gt_idx in used_gt:
                continue
            iou: float = calculate_iou(pred['bbox'], gt['bbox'])
            if iou > best_iou and pred['class'] == gt['class']:
                best_iou = iou
                best_gt_idx = gt_idx
        if best_iou > 0.5:  # IoU threshold
            tp += 1
            used_gt.add(best_gt_idx)
            iou_sum += best_iou
        else:
            fp += 1
    fn: int = len(ground_truth) - len(used_gt)
    precision: float = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall: float = tp / len(ground_truth) if ground_truth else 0.0
    avg_iou: float = iou_sum / tp if tp > 0 else 0.0
    class_acc: float = sum(1 for gt in ground_truth if any(p['class'] == gt['class'] for p in predictions)) / len(ground_truth) if ground_truth else 0.0
    return precision, recall, avg_iou, class_acc

def process_images(model: YOLO, model_name: str, input_dirs: List[str], conn: sqlite3.Connection) -> None:
    for input_dir in input_dirs:
        image_paths: List[Path] = [p for p in Path(input_dir).rglob('*') 
                          if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}]

        for image_path in image_paths:
            cursor = conn.execute('''
                SELECT 1 FROM model_predictions 
                WHERE model = ? AND file = ? LIMIT 1
            ''', (model_name, image_path.name))
            if cursor.fetchone():
                # Skip processing if entry exists
                continue

            # Get predictions
            results = model.predict(image_path)
            boxes = results[0].boxes
            predictions: List[Dict[str, Any]] = [{
                'class': model.names[int(cls.item())],
                'conf': float(conf.item()),
                'bbox': box.tolist()
            } for cls, conf, box in zip(boxes.cls, boxes.conf, boxes.xywhn)]

            # Load ground truth
            label_path: Path = image_path.with_suffix('.txt')
            ground_truth: List[Dict[str, Any]] = load_ground_truth(label_path)

            # Calculate metrics-based loss
            if ground_truth:
                precision, recall, avg_iou, class_acc = calculate_metrics(predictions, ground_truth)
                # Composite loss (weighted combination)
                loss: float = (1.0 - avg_iou) + (1.0 - precision) + (1.0 - recall) + (1.0 - class_acc)
            else:
                # Fallback to confidence-based loss if no ground truth
                confidences: List[float] = [p['conf'] for p in predictions]
                loss = 1 - (sum(confidences)/len(confidences)) if confidences else 1.0
            log_prediction(conn, model_name, image_path.name, image_path.parent, predictions, loss)

if __name__ == "__main__":
    model_name: str = "FEB28_N_1536_v5_T2_v1"
    model_path: str = f"/home/newton/repo/Football-Analysis-using-YOLO/runs/detect/{model_name}/weights/best.pt"
    
    data_paths: List[str] = []
    with open(path / "paths.txt") as f:
        lines: List[str] = f.read().splitlines()
        for line in lines:
            if not line.strip(): continue
            t: str
            pth: str
            t, pth = line.split(" ")
            if t != "D": continue
            data_paths.append(pth)

    print(data_paths)
    conn: sqlite3.Connection = create_db_connection(p/"images.db")
    model: YOLO = YOLO(model_path)
    try:
        process_images(model, model_name, data_paths, conn)
    finally:
        conn.close()

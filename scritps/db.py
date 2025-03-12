import sqlite3
import os
import json
from pathlib import Path

base_path = Path(__file__).parent.parent

def convert_label_to_json(label_path):
    label_list = []
    with open(label_path, 'r') as file:
        label_data = file.readlines()
    for line in label_data:
        parts = line.strip().split()
        label_dict = {
            "class": int(parts[0]),
            "bbox": [float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])]
        }
        label_list.append(label_dict)
    label_json = json.dumps(label_list)
    return label_json


def create_db(db_name=base_path/'images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS root_dirs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_dir TEXT NOT NULL,
            label_classes TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_dir_id INTEGER,
            file TEXT NOT NULL,
            revisions INTEGER DEFAULT 0,
            UNIQUE(file),
            FOREIGN KEY (root_dir_id) REFERENCES root_dirs(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS labels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER NOT NULL,
            labels_json JSON,
            FOREIGN KEY (image_id) REFERENCES images(id)
        )
    ''')
    conn.commit()
    conn.close()

def get_or_insert_root_dir(cursor, root_dir):
    cursor.execute('SELECT id FROM root_dirs WHERE root_dir = ?', (root_dir,))
    row = cursor.fetchone()
    if row:
        return row[0]
    else:
        cursor.execute('INSERT OR IGNORE INTO root_dirs (root_dir) VALUES (?)', (root_dir,))
        return cursor.lastrowid

# Function to populate SQLite database with image paths
def populate_db_with_images(image_path, db_name=base_path/'images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    for root, dirs, files in os.walk(image_path):
        root_dir_id = get_or_insert_root_dir(cursor, root)
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                cursor.execute('''
                    INSERT OR IGNORE INTO images (root_dir_id, file) 
                    VALUES (?, ?)
                ''', (root_dir_id, file))
    conn.commit()
    conn.close()

def update_db_with_labels(label_path, db_name=base_path/'images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    for root, dirs, files in os.walk(label_path):
        for file in files:
            if file.lower().endswith('.txt'):
                label_path = os.path.join(root, file)
                label_json = convert_label_to_json(label_path)
                cursor.execute('''
                    UPDATE labels 
                    SET labels_json = ? 
                    WHERE image_id = (SELECT id FROM images WHERE file = ?) 
                      AND (labels_json IS NULL OR labels_json = ?)
                ''', (label_json, file, json.dumps({})))
    conn.commit()
    conn.close()

def migrate_labels(db_name=base_path/'images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Step 1: Add labels_json to labels table from images.labels
    cursor.execute('SELECT id, labels FROM images')
    rows = cursor.fetchall()

    for image_id, labels_json in rows:
        cursor.execute('''
            INSERT INTO labels (image_id, labels_json)
            VALUES (?, ?)
        ''', (image_id, labels_json))
    conn.commit()
    conn.close()

def remove_labels_column(db_name=base_path/'images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Begin Transaction
    cursor.execute('BEGIN TRANSACTION;')

    # Create a new images table without the labels column
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            root_dir_id INTEGER,
            file TEXT NOT NULL,
            revisions INTEGER DEFAULT 0,
            UNIQUE(file),
            FOREIGN KEY (root_dir_id) REFERENCES root_dirs(id)
        )
    ''')

    # Copy data from old images table to new images table
    cursor.execute('''
        INSERT INTO images_new (id, root_dir_id, file, revisions)
        SELECT id, root_dir_id, image_name, revisions FROM images;
    ''')
    cursor.execute('DROP TABLE images;')
    cursor.execute('ALTER TABLE images_new RENAME TO images;')
    cursor.execute('COMMIT;')
    conn.close()

def set_classes_for_rootdir(db_name=base_path/'images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE root_dirs 
        SET label_classes = "ball goalkeeper player referee" 
    ''')
    conn.commit()
    conn.close()

if __name__ == "__main__":
    print("create db...")
    create_db()
    print("migrate labels...")
    migrate_labels()
    print("remove labels column...")
    remove_labels_column()

    with open("paths.txt", "r") as f:
        f = f.read().splitlines()
        for c,line in enumerate(f, 1):
            if not line.strip(): continue
            t,p = line.split(" ")
            if t=="D":
                populate_db_with_images(p)
            elif t=="L":
                update_db_with_labels(p)


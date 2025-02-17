import sqlite3
import os
import json

def convert_label_to_json(label_path):
    label_list = []
    with open(label_path, 'r') as file:
        label_data = file.readlines()

    for line in label_data:
        parts = line.strip().split()
        label_dict = {
            "class": int(parts[0]),
            "coordinates": [float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])]
        }
        label_list.append(label_dict)

    label_json = json.dumps(label_list)
    return label_json


def create_db(db_name='images.db'):
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
            image_full TEXT NOT NULL,
            image_name TEXT NOT NULL,
            labels JSON,
            FOREIGN KEY (root_dir_id) REFERENCES root_dirs(id)
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
def populate_db_with_images(image_path, db_name='images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    for root, dirs, files in os.walk(image_path):
        root_dir_id = get_or_insert_root_dir(cursor, root)  # Get or insert root directory ID
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                image_full = os.path.join(root, file)
                image_name = file.rsplit('.', 1)[0]
                cursor.execute('''
                    INSERT OR IGNORE INTO images (root_dir_id, image_full, image_name) 
                    VALUES (?, ?, ?)
                ''', (root_dir_id, image_full, image_name))
    conn.commit()
    conn.close()

def update_db_with_labels(label_path, db_name='images.db'):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    for root, dirs, files in os.walk(label_path):
        for file in files:
            if file.lower().endswith('.txt'):
                label_path = os.path.join(root, file)
                label_json = convert_label_to_json(label_path)
                image_name = os.path.splitext(file)[0]
                cursor.execute('''
                    UPDATE images 
                    SET labels = ? 
                    WHERE image_name = ? AND (labels IS NULL OR labels = ?)
                ''', (label_json, image_name, json.dumps({})))
    conn.commit()
    conn.close()

# Example usage
if __name__ == "__main__":
    create_db()
    with open("paths.txt", "r") as f:
        f = f.read().splitlines()
        for c,line in enumerate(f, 1):
            t,p = line.split(" ")
            if t=="L":
                update_db_with_labels(p)
            elif t=="D":
                populate_db_with_images(p)

    conn = sqlite3.connect("images.db")
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE root_dirs 
        SET label_classes = "ball goalkeeper player referee" 
    ''')
    conn.commit()
    conn.close()

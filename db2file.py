import sqlite3
import json
import os
import random
import shutil


def export_labels_from_collection(collection_id, db_name='images.db', output_dir='data'):
    # Define train and validation split ratio
    train_ratio = 0.8

    # Create the required folder structure
    train_labels_dir = os.path.join(output_dir, 'train', 'labels')
    valid_labels_dir = os.path.join(output_dir, 'valid', 'labels')
    train_images_dir = os.path.join(output_dir, 'train', 'images')
    valid_images_dir = os.path.join(output_dir, 'valid', 'images')

    for directory in [train_labels_dir, valid_labels_dir, train_images_dir, valid_images_dir]:
        os.makedirs(directory, exist_ok=True)

    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Fetch all relevant images with labels
    cursor.execute('''
        SELECT i.image_full, i.image_name, i.labels, c.root_dir
        FROM images i
        JOIN root_dirs c ON i.root_dir_id = c.id
        WHERE c.id = ? AND i.labels IS NOT NULL
    ''', (collection_id,))
    rows = cursor.fetchall()
    conn.close()

    # Shuffle the data
    random.shuffle(rows)

    # Split the data
    split_index = int(len(rows) * train_ratio)
    train_data = rows[:split_index]
    valid_data = rows[split_index:]

    # Function to export labels
    def export(data, labels_dir, images_dir):
        for image_full, image_name, labels_json, root_dir in data:
            # Parse labels JSON
            labels = json.loads(labels_json)

            # Prepare label file content
            label_lines = []
            for label in labels:
                label_line = f"{label['class']} " + " ".join(map(str, label['coordinates']))
                label_lines.append(label_line)

            # Write to label file
            label_file_path = os.path.join(labels_dir, f"{image_name}.txt")
            with open(label_file_path, 'w') as label_file:
                label_file.write("\n".join(label_lines))

            #original_image_path = os.path.join(root_dir, image_name)
            shutil.copy(image_full, os.path.join(images_dir, image_full.split("/")[-1]))

    # Export training and validation labels
    export(train_data, train_labels_dir, train_images_dir)
    export(valid_data, valid_labels_dir, valid_images_dir)

# Example usage
if __name__ == "__main__":
    export_labels_from_collection(collection_id=2)  # Replace with desired collection ID

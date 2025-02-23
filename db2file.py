import sqlite3
import json
import os

def export_labels_from_collection(collection_id, db_name='images.db', output_dir='exported_labels'):
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Join collections and images tables to fetch images with labels from a specific collection
    cursor.execute('''
        SELECT i.image_name, i.labels 
        FROM images i
        JOIN collections c ON i.root_dir_id = c.id
        WHERE c.id = ? AND i.labels IS NOT NULL
    ''', (collection_id,))
    rows = cursor.fetchall()
    for image_name, labels_json in rows:
        # Parse labels JSON
        labels = json.loads(labels_json)

        # Prepare label file content
        label_lines = []
        for label in labels:
            label_line = f"{label['class']} " + " ".join(map(str, label['coordinates']))
            label_lines.append(label_line)

        # Write to file
        label_file_path = os.path.join(output_dir, f"{image_name}.txt")
        with open(label_file_path, 'w') as label_file:
            label_file.write("\n".join(label_lines))
    conn.close()

# Example usage
if __name__ == "__main__":
    export_labels_from_collection(collection_id=1)  # Replace with desired collection ID

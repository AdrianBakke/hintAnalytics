let currentIndex = 0;
let images = [];
const container = document.getElementById('container');
const class_names = ['ball', 'keeper', 'player', 'ref']
const class_colors = { 'ball': '#ff0000', 'default': '#00ff00' }

async function loadImages() {
    const res = await fetch('/images');
    images = await res.json();
    updateImageSelect();
    loadCurrentImage();
}

async function loadCurrentImage() {
    const filename = images[currentIndex];

    // Load image
    const img = new Image();
    img.src = `/image/${filename}`;

    // Load labels
    const labelRes = await fetch(`/labels/${filename}`);
    const bboxes = await labelRes.json();

    // Clear container
    container.innerHTML = '';

    img.onload = () => {
        // Draw image
        container.appendChild(img);

        // Draw bounding boxes
        bboxes.forEach(bbox => {
            if (document.getElementById('ballonly').checked && bbox.class !== 'ball') return;

            const [x_center, y_center, width, height] = bbox.coordinates;
            const absWidth = width * img.width;
            const absHeight = height * img.height;
            const left = (x_center * img.width) - (absWidth / 2);
            const top = (y_center * img.height) - (absHeight / 2);

            const box = document.createElement('div');
            box.className = 'bbox';
            box.style.left = `${left}px`;
            box.style.top = `${top}px`;
            box.style.width = `${absWidth}px`;
            box.style.height = `${absHeight}px`;
            box.style.borderColor = class_colors[bbox.class] || class_colors.default;

            const label = document.createElement('div');
            label.className = 'class-label';
            label.textContent = bbox.class;
            label.style.left = `${left}px`;
            label.style.top = `${top - 20}px`;

            container.appendChild(box);
            container.appendChild(label);
        });
    }
}

function updateImageSelect() {
    const select = document.getElementById('imageselect');
    select.innerHTML = images.map((img, index) =>
        `<option value="${index}" ${index === currentIndex ? 'selected' : ''}>${img}</option>`
    ).join('');
    select.onchange = (e) => {
        currentIndex = parseInt(e.target.value);
        loadCurrentImage();
    };
}

function nextImage() {
    currentIndex = (currentIndex + 1) % images.length;
    loadCurrentImage();
    updateImageSelect();
}

function prevImage() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    loadCurrentImage();
    updateImageSelect();
}

// Initial load
loadImages();

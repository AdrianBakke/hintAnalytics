const elements = {
    container: document.getElementById('container'),
    img: document.getElementById('image-view'),
    canvas: document.getElementById('overlay'),
    toggleButton: document.getElementById('toggle-button'),
    drawButton: document.getElementById('draw-button'),
    selectButton: document.getElementById('select-button'),
    runModelButton: document.getElementById('run-model-button'),
    classSelect: document.getElementById('class-select'),
    imgszSelect: document.getElementById('imgsz-select')
};

const ctx = elements.canvas.getContext('2d');

// Initial setup
elements.img.src = `/image/${image}`;
elements.img.onload = () => {
    elements.canvas.width = elements.img.naturalWidth;
    elements.canvas.height = elements.img.naturalHeight;
};
let changeBuffer = [];
let currentStateIndex = -1;

let isLabeledImageShown = false;
let isDrawingMode = false;
let isFetchedLabels = false;
let isPredictDone = false

let selectedClass = null;
let selectedBoxIndex = null;
let classColors = {}
let classNames = {}
let labels = [];

let images = [];
let currentImageIndex = null;

const imageSizes = [
    { width: 640, height: 480 },   // 640x480 (VGA)
    { width: 800, height: 600 },   // 800x600 (SVGA)
    { width: 1024, height: 768 },  // 1024x768 (XGA)
    { width: 1280, height: 720 },  // 1280x720 (HD)
    { width: 1920, height: 1080 }  // 1920x1080 (Full HD)
];

fetch(`/image_id/${image}`)
    .then(res => res.json())
    .then(id => {
        currentImageIndex = Number(id)
    })
    .catch(console.error);

fetch(`/label_classes/${image}`)
    .then(res => res.json())
    .then(classes => {
        Object.entries(classes).forEach(([label, index]) => {
            classColors[index] = `hsl(${(index * 137.5) % 360}, 100%, 50%)`; // Generate distinct colors
            classNames[index] = label
            const option = document.createElement('option');
            option.value = index;
            option.textContent = label;
            elements.classSelect.appendChild(option);
        }, classColors);
    })
    .catch(console.error);


function setImageAndCanvasSize(width, height) {
    const scaleFactorWidth = width / elements.img.naturalWidth;
    const scaleFactorHeight = height / elements.img.naturalHeight;

    elements.img.style.width = `${width}px`;
    elements.img.style.height = `${height}px`;
    elements.canvas.style.width = `${width}px`;
    elements.canvas.style.height = `${height}px`;
    elements.container.style.height = `${height}px`;
    elements.container.style.width = `${width}px`;

    // Optionally, adjust canvas scaling for maintaining aspect ratio
    elements.canvas.width = width;
    elements.canvas.height = height;
}

imageSizes.forEach((dim, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${dim.width}x${dim.height}`;
    elements.imgszSelect.appendChild(option);
});

const defDim = imageSizes[3];
setImageAndCanvasSize(defDim.width, defDim.height);

// Add an event listener to handle changes in the dropdown
elements.imgszSelect.addEventListener('change', (event) => {
    const dim = imageSizes[event.target.value];
    setImageAndCanvasSize(dim.width, dim.height);
});

function updateLabels() {
    const data = {
        filename: image, // Assuming `image` variable holds the current image filename
        labels: labels   // Current state of labels to be saved
    };
    console.log(data)
    fetch('/update_labels', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to update labels");
            }
            return response.json();
        })
        .then(responseData => {
            console.log(responseData.message); // Log success message
        })
        .catch(error => {
            console.error("Error updating labels:", error);
        });
}


function saveState() {
    // Prune buffer to the current state if we've undone some actions
    if (currentStateIndex < changeBuffer.length - 1) {
        changeBuffer = changeBuffer.slice(0, currentStateIndex + 1);
    }
    // Save a deep copy of the current labels state
    changeBuffer.push(labels);
    currentStateIndex++;
    updateLabels(); // Update labels on the server after saving state
}

// Function to undo the last action
function undoLastAction() {
    if (currentStateIndex > 0) {
        currentStateIndex--;
        labels = JSON.parse(JSON.stringify(changeBuffer[currentStateIndex]));
        drawBoxes();
    }
}

// Function to update button styles visually
function updateButtonStyles() {
    elements.toggleButton.style.backgroundColor = isLabeledImageShown ? '#cccccc' : '#ffffff';
    elements.drawButton.style.backgroundColor = isDrawingMode ? '#cccccc' : '#ffffff';
    elements.selectButton.style.backgroundColor = !isDrawingMode ? '#cccccc' : '#ffffff';
    elements.runModelButton.style.backgroundColor = !isPredictDone ? '#cccccc' : '#ffffff';
}

// Function to draw bounding boxes
function drawBoxes() {
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    labels.forEach((label, index) => {
        const [cx, cy, w, h] = label.coordinates;
        const color = index === selectedBoxIndex ? '#0000ff' : classColors[label.class];
        const { width, height } = elements.canvas;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect((cx - w / 2) * width, (cy - h / 2) * height, w * width, h * height);
    });
    updateClassLegend(); // Call function to update legend
}

// Update class legend UI
function updateClassLegend() {
    const legendContainer = document.getElementById('class-legend');
    legendContainer.innerHTML = ''; // Clear previous legend
    Object.entries(classColors).forEach(([label, color]) => {
        const legendItem = document.createElement('div');
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';
        legendItem.innerHTML = `<div style="width: 20px; height: 20px; background-color: ${color}; margin-right: 5px;"></div> ${classNames[label]}`;
        legendContainer.appendChild(legendItem);
    });
}

// Event listeners for buttons
elements.toggleButton.addEventListener('click', () => {
    isLabeledImageShown = !isLabeledImageShown;

    if (isLabeledImageShown) {
        if (!isFetchedLabels) {
            fetch(`/labels/${image}`)
                .then(res => res.json())
                .then(fetchedLabels => {
                    // Ensure `labels` is an array
                    labels = labels.concat(fetchedLabels)
                    saveState();
                    drawBoxes();
                })
                .catch(console.error);
            isFetchedLabels = true;
        } else {
            drawBoxes();
        }
    } else {
        elements.img.src = `/image/${image}`;
        showLabels = [];
        drawBoxes(); // Redraw without labels
    }

    updateButtonStyles(); // Update styles after toggling
});

elements.drawButton.addEventListener('click', () => {
    isDrawingMode = !isDrawingMode;
    selectedBoxIndex = null; // Deselect any selected box
    updateButtonStyles(); // Update styles after toggling
});

elements.selectButton.addEventListener('click', () => {
    isDrawingMode = false; // Disable drawing mode if active
    selectedBoxIndex = null; // Deselect any selected box
    updateButtonStyles(); // Update styles after toggling
});

elements.classSelect.addEventListener('change', (event) => {
    selectedClass = event.target.value; // Set the selected class to the value of the selected option
    console.log(`Selected class: ${selectedClass}`); // Optional: Log the selected class for debugging
});

elements.runModelButton.addEventListener('click', () => {
    if (!isPredictDone) {
        isPredictDone = true
        fetch(`/predict/${image}`)
            .then(res => res.json())
            .then(predictions => {
                labels = labels.concat(predictions)
                saveState();
                drawBoxes();
            })
            .catch(console.error);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
            // Ctrl+Z or Cmd+Z pressed for undo
            undoLastAction();
        }
    } else {
        if (e.key === 'x' && selectedBoxIndex !== null) {
            // 'x' pressed to delete the selected box
            labels.splice(selectedBoxIndex, 1);
            selectedBoxIndex = null;
            drawBoxes();
            saveState(); // Save state after deletion
        } else if (e.key === 'd') {
            elements.drawButton.click(); // Shortcut for draw button
        } else if (e.key === 't') {
            elements.toggleButton.click(); // Shortcut for toggle button
        } else if (e.key === 's') {
            elements.selectButton.click(); // Shortcut for select button
        }
    }

    updateButtonStyles(); // Update styles on key press
});

// Variables for drawing state
let isDrawing = false;
let startX = 0, startY = 0;

elements.canvas.addEventListener('mousedown', (e) => {
    const rect = elements.canvas.getBoundingClientRect();
    const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];

    if (isDrawingMode) {
        startX = x;
        startY = y;
        isDrawing = true;
    } else {
        selectedBoxIndex = labels.findIndex(({ coordinates: [cx, cy, w, h] }) => {
            const [bx, by, bw, bh] = [(cx - w / 2) * elements.canvas.width, (cy - h / 2) * elements.canvas.height, w * elements.canvas.width, h * elements.canvas.height];
            return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
        });
        drawBoxes();
    }
});

elements.canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const rect = elements.canvas.getBoundingClientRect();
    const [currentX, currentY] = [e.clientX - rect.left, e.clientY - rect.top];
    drawBoxes();
    ctx.strokeStyle = classColors[selectedClass]
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
});

elements.canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    const rect = elements.canvas.getBoundingClientRect();
    const [endX, endY] = [e.clientX - rect.left, e.clientY - rect.top];
    saveBoxCoordinates(startX, startY, endX - startX, endY - startY);
    isDrawing = false;
});

function saveBoxCoordinates(x, y, width, height) {
    const { width: imgWidth, height: imgHeight } = elements.canvas;
    const cx = (x + width / 2) / imgWidth;
    const cy = (y + height / 2) / imgHeight;
    const w = width / imgWidth;
    const h = height / imgHeight;
    const selectedClass = Number(elements.classSelect.value); // Get selected class from dropdown
    labels.push({ class: selectedClass, coordinates: [cx, cy, w, h] });
    drawBoxes();
    console.log({ class: selectedClass, cx, cy, w, h });
    saveState(); // Save state after a new box is added
}


//fetch(`/images/2`)
//    .then(res => res.json())
//    .then(imgs => {
//        images = imgs
//        currentImageIndex = images.findIndex(img => img === image);
//        displayedImages = 10; // Reset the number of displayed images
//        createThumbnailBar(images);
//    })
//    .catch(console.error);
let imageHasLabels = {};

// After fetching images, determine which have labels
fetch(`/images/2`)
    .then(res => res.json())
    .then(imgs => {
        images = imgs;
        currentImageIndex = images.findIndex(img => img === image);
        displayedImages = 10; // Reset the number of displayed images

        // Fetch label status for all images
        const labelPromises = images.map(img => {
            return fetch(`/labels/${img}`)
                .then(res => res.json())
                .then(fetchedLabels => {
                    imageHasLabels[img] = fetchedLabels.length > 0;
                })
                .catch(() => {
                    imageHasLabels[img] = false;
                });
        });

        // Wait for all label status fetches to complete
        return Promise.all(labelPromises);
    })
    .then(() => {
        createThumbnailBar(images);
    })
    .catch(console.error);

function createThumbnailBar() {
    const thumbnailBar = document.getElementById('thumbnail-bar');

    thumbnailBar.style.display = 'flex';
    thumbnailBar.style.overflowX = 'hidden';
    thumbnailBar.style.height = '100px';
    thumbnailBar.style.borderTop = '1px solid #ccc';

    // Create and append left arrow button
    const leftArrow = document.createElement('button');
    leftArrow.textContent = '<';
    leftArrow.style.cursor = 'pointer';
    leftArrow.addEventListener('click', () => navigateThumbnails(-1));
    thumbnailBar.appendChild(leftArrow);

    // Create a container for thumbnails
    const thumbnailsContainer = document.createElement('div');
    thumbnailsContainer.style.display = 'flex';
    thumbnailsContainer.style.overflowX = 'scroll';
    thumbnailBar.appendChild(thumbnailsContainer);

    // Create and append right arrow button
    const rightArrow = document.createElement('button');
    rightArrow.textContent = '>';
    rightArrow.style.cursor = 'pointer';
    rightArrow.addEventListener('click', () => navigateThumbnails(1));
    thumbnailBar.appendChild(rightArrow);

    // Initial rendering of thumbnails
    renderThumbnails(thumbnailsContainer);
}

function renderThumbnails(container) {
    container.innerHTML = ''; // Clear previous thumbnails

    const endIndex = Math.min(currentImageIndex + 5, images.length);
    for (let i = currentImageIndex; i < endIndex; i++) {
        const img = images[i];
        const thumbnailWrapper = document.createElement('div');
        thumbnailWrapper.style.position = 'relative';
        thumbnailWrapper.style.display = 'inline-block';

        const thumbnail = document.createElement('img');
        thumbnail.src = `/image/${img}`;
        thumbnail.style.height = '90%';
        thumbnail.style.cursor = 'pointer';
        thumbnail.style.margin = '0 5px';
        thumbnail.style.border = img === image ? '2px solid red' : ''; // Highlight active image
        thumbnail.addEventListener('click', () => { window.location = `/inspect/${img}` });
        thumbnailWrapper.appendChild(thumbnail);

        // If the image has labels, add a semi-transparent green overlay
        if (imageHasLabels[img]) {
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0, 255, 0, 0.3)'; // Semi-transparent green
            overlay.title = 'This image has labels';
            overlay.style.pointerEvents = 'none'; // Allow clicks to pass through
            thumbnailWrapper.appendChild(overlay);
        }

        container.appendChild(thumbnailWrapper);
    }
}

function navigateThumbnails(direction) {
    const maxIndex = images.length - 5;
    if (direction === -1 && currentImageIndex > 0) {
        currentImageIndex -= 1;
    } else if (direction === 1 && currentImageIndex < maxIndex) {
        currentImageIndex += 1;
    }
    const thumbnailsContainer = document.querySelector('#thumbnail-bar div');
    renderThumbnails(thumbnailsContainer); // Update thumbnails without recreating the container
}

// Initialize the thumbnail bar with the current set of images
updateButtonStyles()

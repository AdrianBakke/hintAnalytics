const elements = {
    container: document.getElementById('container'),
    img: document.getElementById('image-view'),
    canvas: document.getElementById('overlay'),
    toggleButton: document.getElementById('toggle-button'),
    drawButton: document.getElementById('draw-button'),
    selectButton: document.getElementById('select-button'),
    runModelButton: document.getElementById('run-model-button'), // New button for running the model
    classSelect: document.getElementById('class-select') // Dropdown or other element for class selection
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

let selectedBoxIndex = null;
let classColors = {}
let labels = [];

fetch(`/label_classes/${image}`)
    .then(res => res.json())
    .then(classes => {
        console.log(classes)
        // Update class colors and UI
        Object.entries(classes).forEach(([label, index]) => {
            console.log(label, index)
            classColors[label] = `hsl(${(index * 137.5) % 360}, 100%, 50%)`; // Generate distinct colors
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label;
            elements.classSelect.appendChild(option);
        }, classColors);
    })
    .catch(console.error);


function updateLabels() {
    const data = {
        filename: image, // Assuming `image` variable holds the current image filename
        labels: labels   // Current state of labels to be saved
    };
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
    changeBuffer.push(JSON.parse(JSON.stringify(labels)));
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
        const color = index === selectedBoxIndex ? '#0000ff' : (classColors[label.class] || classColors.default);
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
        legendItem.innerHTML = `<div style="width: 20px; height: 20px; background-color: ${color}; margin-right: 5px;"></div> ${label}`;
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

elements.runModelButton.addEventListener('click', () => {
    if (!isPredictDone) {
        isPredictDone = true
        fetch(`/predict/${image}`)
            .then(res => res.json())
            .then(predictions => {
                console.log(predictions)
                // Ensure `labels` is an array
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
    ctx.strokeStyle = '#0000ff';
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
    const selectedClass = elements.classSelect.value; // Get selected class from dropdown
    labels.push({ class: selectedClass, coordinates: [cx, cy, w, h] });
    drawBoxes();
    console.log({ class: selectedClass, cx, cy, w, h });

    saveState(); // Save state after a new box is added
}


updateButtonStyles()

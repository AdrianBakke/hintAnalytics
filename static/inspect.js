/* TODO
 * create run model button
 * regret box created with ctrl z
 * keyboard shortcut for each of the buttons
 * needs a way to choose class for box
 */

const elements = {
    container: document.getElementById('container'),
    img: document.getElementById('image-view'),
    canvas: document.getElementById('overlay'),
    toggleButton: document.getElementById('toggle-button'),
    drawButton: document.getElementById('draw-button'),
    selectButton: document.getElementById('select-button')
};

const ctx = elements.canvas.getContext('2d');

// Initial setup
elements.img.src = `/image/${image}`;
elements.canvas.width = elements.img.naturalWidth;
elements.canvas.height = elements.img.naturalHeight;
let isLabeledImageShown = false;
let isDrawingMode = false;
let selectedBoxIndex = null;
const classColors = { 'ball': '#ff0000', 'default': '#00ff00' };
var fetchedLabels = [];

function updateButtonStyles() {
    // Toggle button style
    elements.toggleButton.style.backgroundColor = isLabeledImageShown ? '#cccccc' : '#ffffff';

    // Draw button style
    elements.drawButton.style.backgroundColor = isDrawingMode ? '#cccccc' : '#ffffff';

    // Select button style
    elements.selectButton.style.backgroundColor = !isDrawingMode ? '#cccccc' : '#ffffff';
}

// Function to draw bounding boxes
function drawBoxes() {
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    fetchedLabels.forEach((label, index) => {
        const [cx, cy, w, h] = label.coordinates;
        const color = index === selectedBoxIndex ? '#0000ff' : (classColors[label.class] || classColors.default);
        const { width, height } = elements.canvas;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect((cx - w / 2) * width, (cy - h / 2) * height, w * width, h * height);
    });
}

// Event listeners for buttons
elements.toggleButton.addEventListener('click', () => {
    if (isLabeledImageShown) {
        elements.img.src = `/image/${image}`;
        fetchedLabels = [];
        drawBoxes(); // Redraw without labels
    } else {
        fetch(`/labels/${image}`)
            .then(res => res.json())
            .then(labels => {
                fetchedLabels.splice(0, fetchedLabels.length, ...labels);
                drawBoxes();
            })
            .catch(console.error);
    }
    isLabeledImageShown = !isLabeledImageShown;
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

// Function to handle keyboard shortcuts
function handleShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
            // Ctrl+Z or Cmd+Z pressed
            if (selectedBoxIndex !== null) {
                fetchedLabels.splice(selectedBoxIndex, 1); // Remove selected box
                selectedBoxIndex = null; // Clear selection
                drawBoxes();
            }
        }
    }
}

document.addEventListener('keydown', (e) => {
    handleShortcuts(e); // Handle shortcuts for deleting boxes
    if (e.key === 'd') {
        elements.drawButton.click(); // Shortcut for draw button
    } else if (e.key === 't') {
        elements.toggleButton.click(); // Shortcut for toggle button
    } else if (e.key === 's') {
        elements.selectButton.click(); // Shortcut for select button
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
        selectedBoxIndex = fetchedLabels.findIndex(({ coordinates: [cx, cy, w, h] }) => {
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

// Function to save new box coordinates
function saveBoxCoordinates(x, y, width, height) {
    const { width: imgWidth, height: imgHeight } = elements.canvas;
    const cx = (x + width / 2) / imgWidth;
    const cy = (y + height / 2) / imgHeight;
    const w = width / imgWidth;
    const h = height / imgHeight;
    fetchedLabels.push({ class: 'new', coordinates: [cx, cy, w, h] });
    drawBoxes();
    console.log({ cx, cy, w, h });
}


// Utility Functions
const getElement = (id) => document.getElementById(id);
const createElement = (tag, attributes = {}, ...children) => {
    const element = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
        if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element[key] = value;
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') element.appendChild(document.createTextNode(child));
        else if (child instanceof Node) element.appendChild(child);
    });
    return element;
};

// Initial Setup
const elements = {
    container: getElement('container'),
    img: getElement('image-view'),
    canvas: getElement('overlay'),
    toggleLButton: getElement('toggle-l-button'),
    togglePButton: getElement('toggle-p-button'),
    drawButton: getElement('draw-button'),
    selectButton: getElement('select-button'),
    saveButton: getElement('save-button'),
    classSelect: getElement('class-select'),
    imgszSelect: getElement('imgsz-select'),
    classLegend: getElement('class-legend'),
    thumbnailBar: getElement('thumbnail-bar')
};

const ctx = elements.canvas.getContext('2d');

const imageSizes = [
    { width: 640, height: 480 },   // VGA
    { width: 800, height: 600 },   // SVGA
    { width: 1024, height: 768 },  // XGA
    { width: 1280, height: 720 },  // HD
    { width: 1920, height: 1080 }  // Full HD
];

// State Management
const initialState = {
    image: image, // To be set dynamically
    imageId: null,
    labels: [],
    predictions: [],
    changeBuffer: [],
    currentStateIndex: -1,
    isLabeledShown: false,
    isPredictionShown: false,
    isDrawingMode: false,
    isFetchedLabels: false,
    isPredictDone: false,
    selectedClass: null,
    selectedBoxIndex: null,
    classColors: {},
    classNames: {},
    images: [],
    currentImageIndex: null,
    imageHasLabels: {},
    isDrawing: false,
    startX: 0,
    startY: 0
};

// State Setter
let state = initialState;
const setState = (newState) => {
    state = newState;
};

// Pure Function to Configure Class Colors and Names
const configureClasses = (classes) => {
    const classColors = {};
    const classNames = {};
    Object.entries(classes).forEach(([label, index]) => {
        classColors[index] = `hsl(${(index * 137.5) % 360}, 100%, 50%)`;
        classNames[index] = label;
    });
    return { classColors, classNames };
};

// Populate Class Select Dropdown
const populateClassSelect = (classSelect, classes, onChange) => {
    classes.forEach(([label, index]) => {
        const option = createElement('option', { value: index }, label);
        classSelect.appendChild(option);
    });
    classSelect.addEventListener('change', onChange);
};

// Image and Canvas Sizes
const setImageAndCanvasSize = (img, canvas, container, width, height) => {
    return () => {
        const dimensions = { width, height };
        Object.entries(dimensions).forEach(([key, value]) => {
            img.style[key] = `${value}px`;
            canvas.style[key] = `${value}px`;
            container.style[key] = `${value}px`;
        });
        canvas.width = width;
        canvas.height = height;
    };
};

// Update Labels on the Server
const updateLabels = async (image, labels) => {
    const data = { filename: image, labels };
    try {
        const response = await fetch('/update_labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error("Failed to update labels");
        const responseData = await response.json();
        console.log(responseData.message);
    } catch (error) {
        console.error("Error updating labels:", error);
    }
};

// Save State
const saveState = (state, persistent) => {
    const { image, labels, changeBuffer, currentStateIndex } = state;
    const newBuffer = currentStateIndex < changeBuffer.length - 1
        ? changeBuffer.slice(0, currentStateIndex + 1)
        : changeBuffer.slice();
    newBuffer.push([...labels]);
    if (persistent) {
        updateLabels(state.image, labels)
    }
    return { ...state, changeBuffer: newBuffer, currentStateIndex: currentStateIndex + 1 };
};

// Undo Last Action
const undoLastAction = (state) => {
    if (state.currentStateIndex > 0) {
        const newIndex = state.currentStateIndex - 1;
        return {
            ...state,
            labels: [...state.changeBuffer[newIndex]],
            currentStateIndex: newIndex,
            selectedBoxIndex: null
        };
    }
    return state;
};

// Update Button Styles
const updateButtonStyles = (state, elements) => {
    const { isPredictionShown, isLabeledShown, isDrawingMode } = state;
    const styles = {
        toggleLButton: isLabeledShown ? '#cccccc' : '#ffffff',
        togglePButton: isPredictionShown ? '#cccccc' : '#ffffff',
        drawButton: isDrawingMode ? '#cccccc' : '#ffffff',
        selectButton: !isDrawingMode ? '#cccccc' : '#ffffff',
    };
    Object.entries(styles).forEach(([key, color]) => {
        elements[key].style.backgroundColor = color;
    });
};

// Draw Bounding Boxes
const drawBoxes = (ctx, canvas, boxes, classColors, selectedBoxIndex, isPrediction = false) => {
    boxes.forEach((box, index) => {
        const [cx, cy, w, h] = box.coordinates;
        const color = index === selectedBoxIndex ? '#0000ff' : classColors[box.class];
        ctx.strokeStyle = color;
        ctx.lineWidth = isPrediction ? 1 : 2; // Thinner lines for predictions

        // Add dashed lines for predictions
        if (isPrediction) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        ctx.strokeRect(
            (cx - w / 2) * canvas.width,
            (cy - h / 2) * canvas.height,
            w * canvas.width,
            h * canvas.height
        );

        // Reset line dash to default
        ctx.setLineDash([]);
    });
};

const drawAllBoxes = (ctx, canvas, state) => {
    if (state.isLabeledShown) {
        drawBoxes(ctx, canvas, state.labels, state.classColors, state.selectedBoxIndex);
    }
    if (state.isPredictionShown) {
        drawBoxes(ctx, canvas, state.predictions, state.classColors, state.selectedBoxIndex, true);
    }
};


// Update Class Legend
const updateClassLegend = (classColors, classNames, legendContainer) => {
    legendContainer.innerHTML = '';
    Object.entries(classColors).forEach(([label, color]) => {
        const legendItem = createElement('div', { style: 'display: flex; align-items: center;' },
            createElement('div', { style: `width: 20px; height: 20px; background-color: ${color}; margin-right: 5px;` }),
            document.createTextNode(classNames[label])
        );
        legendContainer.appendChild(legendItem);
    });
};

// Event Handlers
const handleToggleLabelButtonClick = async (state) => {
    const newState = { ...state, isLabeledShown: !state.isLabeledShown };
    if (newState.isLabeledShown) {
        try {
            if (!newState.isFetchedLabels) {
                const fetchedLabels = await fetchLabels(newState.image);
                newState.labels = fetchedLabels;
                newState.isFetchedLabels = true;
            }
            drawAllBoxes(ctx, elements.canvas, newState);
        } catch (error) {
            console.error(error);
        }
    } else if (!newState.isLabeledShown) {
        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
        drawAllBoxes(ctx, elements.canvas, newState);
    }
    setState(saveState(newState, false));
    updateButtonStyles(newState, elements);
};

const handleTogglePredictionButtonClick = async (state) => {
    var newState = { ...state, isPredictionShown: !state.isPredictionShown };
    console.log(newState)
    if (!state.isPredictDone) {
        try {
            const predictions = await fetchPredictions(state.image);
            newState = {
                ...newState,
                predictions: predictions,
                isPredictDone: true,
            };
            drawBoxes(ctx, elements.canvas, newState.predictions, newState.classColors, newState.selectedBoxIndex, true);
        } catch (error) {
            console.error(error);
        }
    }
    else if (newState.isPredictionShown) {
        drawBoxes(ctx, elements.canvas, newState.predictions, newState.classColors, newState.selectedPredictionIndex, true);
    } else {
        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    }
    setState(saveState(newState, false));
    updateButtonStyles(newState, elements);
};

// const handleToggleLabelButtonClick = (state) => {
//     const newState = { ...state, isLabeledShown: !state.isLabeledShown };
//     if (newState.isLabeledShown) {
//         drawBoxes(ctx, elements.canvas, newState.labels, newState.classColors, newState.selectedBoxIndex);
//     } else {
//         ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
//     }
//     setState(newState);
//     updateButtonStyles(newState, elements);
// };
const handleSaveButtonClick = (state) => {
    updateLabels(state.image, state.labels);
}

const handleDrawButtonClick = (state) => {
    const newState = {
        ...state,
        isDrawingMode: !state.isDrawingMode,
        selectedBoxIndex: null
    };
    setState(newState);
    updateButtonStyles(newState, elements);
};

const handleSelectButtonClick = (state) => {
    const newState = {
        ...state,
        isDrawingMode: false,
        selectedBoxIndex: null
    };
    setState(newState);
    updateButtonStyles(newState, elements);
};

const handleClassSelectChange = (state, event) => {
    const newState = { ...state, selectedClass: Number(event.target.value) };
    setState(newState);
};

// Fetch Functions
const fetchLabels = async (image) => {
    const res = await fetch(`/labels/${image}`);
    if (!res.ok) throw new Error("Failed to fetch labels");
    return await res.json();
};

const fetchPredictions = async (image) => {
    const res = await fetch(`/predict/${image}`);
    if (!res.ok) throw new Error("Failed to fetch predictions");
    return await res.json();
};

const fetchImageId = async (image) => {
    const res = await fetch(`/image_id/${image}`);
    if (!res.ok) throw new Error("Failed to fetch image ID");
    const id = await res.json();
    return Number(id);
};

const fetchClasses = async (image) => {
    const res = await fetch(`/label_classes/${image}`);
    if (!res.ok) throw new Error("Failed to fetch label classes");
    return await res.json();
};

const fetchImages = async () => {
    const res = await fetch(`/images/2`);
    if (!res.ok) throw new Error("Failed to fetch images");
    return await res.json();
};

const fetchLabelStatus = async (images) => {
    const statusPromises = images.map(async (img) => {
        try {
            const labels = await fetchLabels(img);
            return { img, hasLabels: labels.length > 0 };
        } catch {
            return { img, hasLabels: false };
        }
    });
    const statuses = await Promise.all(statusPromises);
    return statuses.reduce((acc, { img, hasLabels }) => {
        acc[img] = hasLabels;
        return acc;
    }, {});
};


const sortImages = (images) => {
    // Assuming images are strings, sort them lexicographically
    return images.sort((a, b) => a.localeCompare(b));
};

// Initialize Application
const initializeApp = async () => {
    try {
        const image = state.image; // Set this appropriately
        elements.img.src = `/image/${image}`;

        const [imageId, classes] = await Promise.all([
            fetchImageId(image),
            fetchClasses(image)
        ]);
        setState({ ...state, imageId });

        const { classColors, classNames } = configureClasses(classes);
        setState({ ...state, classColors, classNames });
        populateClassSelect(elements.classSelect, Object.entries(classes), (e) => handleClassSelectChange(state, e));

        // Populate image size options
        imageSizes.forEach((dim, index) => {
            const option = createElement('option', { value: index }, `${dim.width}x${dim.height}`);
            elements.imgszSelect.appendChild(option);
        });
        elements.imgszSelect.selectedIndex = 3;
        setImageAndCanvasSize(elements.img, elements.canvas, elements.container, imageSizes[3].width, imageSizes[3].height)();

        elements.imgszSelect.addEventListener('change', (e) => {
            const dim = imageSizes[e.target.value];
            setImageAndCanvasSize(elements.img, elements.canvas, elements.container, dim.width, dim.height)();
        });

        let images = await fetchImages(2);
        // images = sortImages(images);
        const imageHasLabels = await fetchLabelStatus(images);
        setState({ ...state, images, imageHasLabels, currentImageIndex: images.indexOf(image) });


        createThumbnailBar(images, elements);
        updateButtonStyles(state, elements);
    } catch (error) {
        console.error(error);
    }
};


// Event Listener Handlers
elements.togglePButton.addEventListener('click', () => handleTogglePredictionButtonClick(state));
elements.toggleLButton.addEventListener('click', () => handleToggleLabelButtonClick(state));
elements.drawButton.addEventListener('click', () => handleDrawButtonClick(state));
elements.selectButton.addEventListener('click', () => handleSelectButtonClick(state));
elements.saveButton.addEventListener('click', () => handleSaveButtonClick(state));

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        setState(undoLastAction(state));
        drawBoxes(ctx, elements.canvas, state.labels, state.classColors, state.selectedBoxIndex);
        drawBoxes(ctx, elements.canvas, state.predictions, state.classColors, state.selectedBoxIndex, true);
    } else {
        switch (e.key) {
            case 'x':
                if (state.selectedBoxIndex !== null) {
                    const updatedLabels = state.labels.filter((_, idx) => idx !== state.selectedBoxIndex);
                    setState({ ...state, labels: updatedLabels, selectedBoxIndex: null });
                    drawBoxes(ctx, elements.canvas, updatedLabels, state.classColors, null);
                }
                break;
            case 'd':
                elements.drawButton.click();
                break;
            case 's':
                elements.selectButton.click();
                break;
            case 'l':
                handleToggleLabelButtonClick(state);
                break;
            case 'p':
                handleTogglePredictionButtonClick(state);
                break;
            default:
                break;
        }
    }
    updateButtonStyles(state, elements);
});

const addPredictionToLabels = (state, predictionIndex) => {
    const prediction = state.predictions[predictionIndex];
    const newLabels = [...state.labels, prediction];
    setState(saveState({ ...state, labels: newLabels }, true));
    updateLabels(state.image, newLabels);
    drawBoxes(ctx, elements.canvas, newLabels, state.classColors, state.selectedBoxIndex);
};

const confirmAddPrediction = (prediction) => {
    return new Promise((resolve) => {
        const confirmBox = createElement('div', {
            style: `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `
        },
            createElement('div', {
                style: `
                    background: white;
                    padding: 20px;
                    border-radius: 5px;
                    text-align: center;
                `
            },
                createElement('p', {}, 'Add this prediction to labels?'),
                createElement('button', {
                    onclick: () => {
                        document.body.removeChild(confirmBox);
                        resolve(true);
                    },
                    style: 'margin: 10px; padding: 5px 10px;'
                }, 'OK'),
                createElement('button', {
                    onclick: () => {
                        document.body.removeChild(confirmBox);
                        resolve(false);
                    },
                    style: 'margin: 10px; padding: 5px 10px;'
                }, 'Cancel')
            )
        );
        document.body.appendChild(confirmBox);
    });
};

elements.canvas.addEventListener('mousedown', async (e) => { // Changed to async
    const rect = elements.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (state.isDrawingMode) {
        setState({ ...state, isDrawing: true, startX: x, startY: y });
    } else {
        if (state.isLabeledShown) {
            const selectedIndex = state.labels.findIndex(({ coordinates: [cx, cy, w, h] }) => {
                const bx = (cx - w / 2) * elements.canvas.width;
                const by = (cy - h / 2) * elements.canvas.height;
                const bw = w * elements.canvas.width;
                const bh = h * elements.canvas.height;
                return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
            });
        }

        if (state.isPredictionShown) {
            const selectedPredictionIndex = state.predictions.findIndex(({ coordinates: [cx, cy, w, h] }) => {
                const bx = (cx - w / 2) * elements.canvas.width;
                const by = (cy - h / 2) * elements.canvas.height;
                const bw = w * elements.canvas.width;
                const bh = h * elements.canvas.height;
                return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
            });
        }

        setState({
            ...state,
            selectedBoxIndex: selectedIndex !== -1 ? selectedIndex : null,
            selectedPredictionIndex: selectedPredictionIndex !== -1 ? selectedPredictionIndex : null
        });

        if (selectedPredictionIndex !== -1) { // Updated condition
            const prediction = state.predictions[selectedPredictionIndex];
            const userConfirmed = await confirmAddPrediction(prediction);
            if (userConfirmed) {
                addPredictionToLabels(state, selectedPredictionIndex);
            }
        } else {
            drawBoxes(ctx, elements.canvas, state.labels, state.classColors, state.selectedBoxIndex);
            drawBoxes(ctx, elements.canvas, state.predictions, state.classColors, state.selectedPredictionIndex, true);
        }
    }
});

const MIN_BOX_WIDTH = 10;
const MIN_BOX_HEIGHT = 10;
elements.canvas.addEventListener('mouseup', (e) => {
    if (!state.isDrawing) return;
    const rect = elements.canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const width = Math.abs(endX - state.startX);
    const height = Math.abs(endY - state.startY);

    // Check if the drawn box meets the minimum size requirements
    if (width >= MIN_BOX_WIDTH && height >= MIN_BOX_HEIGHT) {
        const newLabel = createNewLabel(state, endX, endY);
        setState(saveState({ ...state, labels: [...state.labels, newLabel], isDrawing: false }, true));
        drawBoxes(ctx, elements.canvas, [...state.labels, newLabel], state.classColors, state.selectedBoxIndex);
        updateLabels(state.image, [...state.labels, newLabel]);
    } else {
        // If the box is too small, cancel drawing
        setState({ ...state, isDrawing: false });
        drawBoxes(ctx, elements.canvas, state.labels, state.classColors, state.selectedBoxIndex);
    }
});

// Create New Label Coordinates
const createNewLabel = (state, endX, endY) => {
    const { startX, startY } = state;
    const x = state.startX;
    const y = state.startY;
    const width = endX - x;
    const height = endY - y;
    const cx = (x + width / 2) / elements.canvas.width;
    const cy = (y + height / 2) / elements.canvas.height;
    const w = width / elements.canvas.width;
    const h = height / elements.canvas.height;
    const selectedClass = state.selectedClass || Number(elements.classSelect.value);
    return { class: selectedClass, coordinates: [cx, cy, w, h] };
};

// Thumbnail Bar Functions
const createThumbnailBar = (images, elements) => {
    elements.thumbnailBar.style.display = 'flex';
    elements.thumbnailBar.style.overflowX = 'hidden';
    elements.thumbnailBar.style.height = '100px';
    elements.thumbnailBar.style.borderTop = '1px solid #ccc';

    const leftArrow = createElement('button', { style: 'cursor: pointer;' }, '<');
    leftArrow.addEventListener('click', () => navigateThumbnails(-1, elements));

    const thumbnailsContainer = createElement('div', { style: 'display: flex; overflow-x: scroll;' });
    renderThumbnails(thumbnailsContainer, elements);

    const rightArrow = createElement('button', { style: 'cursor: pointer;' }, '>');
    rightArrow.addEventListener('click', () => navigateThumbnails(1, elements));

    elements.thumbnailBar.appendChild(leftArrow);
    elements.thumbnailBar.appendChild(thumbnailsContainer);
    elements.thumbnailBar.appendChild(rightArrow);
};

const renderThumbnails = (container, elements) => {
    container.innerHTML = '';
    const { images, currentImageIndex, imageHasLabels, image } = state;
    const endIndex = Math.min(currentImageIndex + 5, images.length);
    const thumbnails = images.slice(currentImageIndex, endIndex).map(img => {
        const thumbnailWrapper = createElement('div', { style: 'position: relative; display: inline-block;' });

        const thumbnail = createElement('img', {
            src: `/image/${img}`,
            style: 'height: 90%; cursor: pointer; margin: 0 5px;',
            border: img === image ? '2px solid red' : '',
            title: 'Click to inspect',
            onclick: () => window.location = `/inspect/${img}`
        });

        thumbnailWrapper.appendChild(thumbnail);

        if (imageHasLabels[img]) {
            const overlay = createElement('div', {
                style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 255, 0, 0.3); pointer-events: none;',
                title: 'This image has labels'
            });
            thumbnailWrapper.appendChild(overlay);
        }

        return thumbnailWrapper;
    });

    thumbnails.forEach(thumbnail => container.appendChild(thumbnail));
};

const navigateThumbnails = (direction, elements) => {
    const { currentImageIndex, images } = state;
    const maxIndex = images.length;
    let newIndex = currentImageIndex;
    if (direction === -1 && currentImageIndex > 0) {
        newIndex -= 1;
    } else if (direction === 1 && currentImageIndex < maxIndex) {
        newIndex += 1;
    }
    setState({ ...state, currentImageIndex: newIndex });
    const thumbnailsContainer = elements.thumbnailBar.querySelector('div');
    renderThumbnails(thumbnailsContainer, elements);
};

// Initialize the application
initializeApp();

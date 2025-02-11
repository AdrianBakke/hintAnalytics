const container = document.getElementById('container');
const img = document.getElementById('image-view');
const canvas = document.getElementById('overlay');
const toggleButton = document.getElementById('toggle-button');
const ctx = canvas.getContext('2d');

// Set up toggle button properties and append to body
toggleButton.textContent = 'Show Labeled Image';

img.src = `/image/${image}`;

// Toggle state
let isLabeledImageShown = false;

const classColors = {
    'ball': '#ff0000',
    'default': '#00ff00'
};
//
// Function to draw bounding boxes on canvas
function drawBoxes(labels) {
    labels.forEach(label => {
        const [cx, cy, w, h] = label.coordinates;
        const color = classColors[label.class] || classColors.default;

        // Convert normalized coordinates to pixels
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        const x = (cx - w / 2) * imgWidth;
        const y = (cy - h / 2) * imgHeight;
        const width = w * imgWidth;
        const height = h * imgHeight;

        // Draw rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
    });
}

// Event listener for toggle button
toggleButton.addEventListener('click', () => {
    if (isLabeledImageShown) {
        // Show original image and clear canvas
        img.src = `/image/${image}`;
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
        toggleButton.textContent = 'Show Labeled Image';
    } else {
        // Fetch and show labeled image
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        fetch(`/labels/${image}`)
            .then(res => res.json())
            .then(labels => drawBoxes(labels))
            .catch(console.error);

        toggleButton.textContent = 'Show Original Image';
    }

    isLabeledImageShown = !isLabeledImageShown;
});
// Class colors mapping



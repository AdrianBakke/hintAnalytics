function initializeImageView(filename) {
    const singleView = document.getElementById('single-view');
    const imageElement = document.createElement('img');
    imageElement.style.width = "70%";
    imageElement.style.height = "70%";
    singleView.innerHTML = '';
    singleView.appendChild(imageElement);

    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Show Labeled Image';
    document.body.appendChild(toggleButton);

    let isLabeledImageShown = false;

    // Original image URL
    const originalImageSrc = `/image/${filename}`; // Replace with actual path

    // Labeled image URL
    const labeledImageSrc = `/draw_labels/${filename}`;

    // Initially display the original image
    imageElement.src = originalImageSrc;

    toggleButton.addEventListener('click', () => {
        if (isLabeledImageShown) {
            // Show original image
            imageElement.src = originalImageSrc;
            toggleButton.textContent = 'Show Labeled Image';
        } else {
            // Fetch and show labeled image
            fetch(labeledImageSrc)
                .then(response => response.blob())
                .then(blob => {
                    const labeledImageURL = URL.createObjectURL(blob);
                    imageElement.src = labeledImageURL;
                });

            toggleButton.textContent = 'Show Original Image';
        }

        isLabeledImageShown = !isLabeledImageShown;
    });
}

function drawLabelsOnImage(imageElement, labels) {
    // Create a canvas element to overlay labels
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Set canvas dimensions to the image dimensions
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;

    // Load the image onto the canvas
    const img = new Image();
    img.src = imageElement.src;
    img.onload = () => {
        // Draw the image on the canvas
        context.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Draw labels on the canvas
        labels.forEach(label => {
            const { class: className, coordinates } = label;
            const [centerX, centerY, width, height] = coordinates;

            // Scale coordinates based on image size
            const canvasCenterX = centerX * canvas.width;
            const canvasCenterY = centerY * canvas.height;
            const canvasWidth = width * canvas.width;
            const canvasHeight = height * canvas.height;

            // Calculate top-left corner from center coordinates
            const canvasX = canvasCenterX - canvasWidth / 2;
            const canvasY = canvasCenterY - canvasHeight / 2;

            // Draw rectangle for the label
            context.strokeStyle = 'red';
            context.lineWidth = 2;
            context.strokeRect(canvasX, canvasY, canvasWidth, canvasHeight);

            // Draw label text
            context.fillStyle = 'red';
            context.font = '14px Arial';
            context.fillText(className, canvasX, canvasY - 5);
        });

        // Replace image with canvas in the DOM
        imageElement.parentNode.replaceChild(canvas, imageElement);
    };
}

// Call the function with the desired image
initializeImageView(image); // Replace 'your_image_name_here' with the actual image name

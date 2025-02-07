let currentIndex = 0;
let images = [];
let displayedImages = 50;
const container = document.getElementById('container');
const thumbnailGrid = document.getElementById('thumbnail-grid');
const singleView = document.getElementById('single-view');
const seeMoreButton = document.getElementById('see-more-button');

async function loadImages() {
    const res = await fetch('/images');
    images = await res.json();
    createThumbnailGrid();
    setupSeeMoreButton();
}

function createThumbnailGrid() {
    const imagesToDisplay = images.slice(0, displayedImages);
    thumbnailGrid.innerHTML = imagesToDisplay.map((img, index) => `
        <img src="/image/${img}" 
             onclick="showSingleView(${index})"
             class="${index === currentIndex ? 'active' : ''}">
    `).join('');
}

function setupSeeMoreButton() {
    if (displayedImages < images.length) {
        seeMoreButton.style.display = 'block';
        seeMoreButton.onclick = () => {
            displayedImages += 50;
            createThumbnailGrid();
            setupSeeMoreButton();
        };
    } else {
        seeMoreButton.style.display = 'none';
    }
}

function showGridView() {
    thumbnailGrid.style.display = 'grid';
    singleView.style.display = 'none';
    createThumbnailGrid();
}

function showSingleView(index) {
    currentIndex = index ?? currentIndex;
    thumbnailGrid.style.display = 'none';
    singleView.style.display = 'block';
    updateNeighborThumbnails();
    loadCurrentImage();
}

function updateNeighborThumbnails() {
    const neighborDiv = document.getElementById('neighbor-thumbnails');
    const imagesToDisplay = images.slice(0, displayedImages);
    neighborDiv.innerHTML = imagesToDisplay.map((img, index) => `
        <img src="/image/${img}" 
             class="neighbor-thumbnail ${index === currentIndex ? 'active' : ''}"
             onclick="currentIndex=${index}; updateNeighborThumbnails(); loadCurrentImage()">
    `).join('');
}

async function loadCurrentImage() {
    // Fetch the current image based on the currentIndex
    const currentImageSrc = `/image/${images[currentIndex]}`;

    // Set the src attribute of the single view image element
    const imageElement = document.createElement('img');
    imageElement.src = currentImageSrc;
    imageElement.style.width = "70%";
    imageElement.style.height = "70%";

    // Clear the single view container and append the new image
    singleView.innerHTML = '';
    singleView.appendChild(imageElement);

    // Once the image is loaded, update the active class on the thumbnails
    imageElement.onload = () => {
        document.querySelectorAll('.thumbnail-grid img, .neighbor-thumbnail').forEach(el => {
            el.classList.remove('active');
        });
        document.querySelectorAll(`.thumbnail-grid img:nth-child(${currentIndex + 1}),
                                  .neighbor-thumbnail:nth-child(${currentIndex + 1})`).forEach(el => {
            el.classList.add('active');
        });
    };
}

function nextImage() {
    currentIndex = (currentIndex + 1) % images.length;
    loadCurrentImage();
    updateNeighborThumbnails();
}

function prevImage() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    loadCurrentImage();
    updateNeighborThumbnails();
}

// Initial load
loadImages();

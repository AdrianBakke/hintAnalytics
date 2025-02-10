let currentIndex = 0;
let images = [];
let displayedImages = 50;
const container = document.getElementById('container');
const thumbnailGrid = document.getElementById('thumbnail-grid');
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
             onclick="navigateToSingleView(${index})"
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

function navigateToSingleView(index) {
    currentIndex = index ?? currentIndex;
    window.location.href = `inspect/${images[currentIndex]}`;
}


async function loadCurrentImage() {
    const currentImageSrc = `/image/${images[currentIndex]}`;
}

loadImages();

let currentCollectionIndex = 0;

let collections = [];
let images = [];
let displayedImages = 50;
const container = document.getElementById('container');
const collectionGrid = document.getElementById('collection-grid');
const thumbnailGrid = document.getElementById('thumbnail-grid');
const seeMoreButton = document.getElementById('see-more-button');

// Load image collections from the server
async function loadCollections() {
    const res = await fetch('/image_collections');
    collections = await res.json();
    createCollectionGrid();
}

// Create grid to display collections
function createCollectionGrid() {
    collectionGrid.innerHTML = collections.map((collection, index) => `
        <div onclick="handleCollectionClick(${index})" class="collection-item">
            <img src="/image/${collection.cover_image}" alt="${collection.name}">
            <p>${collection.name}</p>
        </div>
    `).join('');
}

// Handle collection click and load images for the clicked collection
async function handleCollectionClick(collectionIndex) {
    currentCollectionIndex = collectionIndex; // Update the current collection index
    await loadCollectionImages(collectionIndex); // Load images for the specific collection
}

// Load images for a specific collection
async function loadCollectionImages(collectionIndex) {
    const collectionId = collections[collectionIndex].id;
    console.log("called")
    const res = await fetch(`/images/${collectionId}`);
    images = await res.json();
    displayedImages = 50; // Reset the number of displayed images
    createThumbnailGrid();
    setupSeeMoreButton();
}

// Create the thumbnail grid for images
function createThumbnailGrid() {
    const imagesToDisplay = images.slice(0, displayedImages);
    console.log("called")
    thumbnailGrid.innerHTML = imagesToDisplay.map((img, index) => `
        <img src="/image/${img}" 
             onclick="navigateToSingleView(${index})"
             class="${index === currentCollectionIndex ? 'active' : ''}">
    `).join('');
}

// Setup the "See More" button functionality
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

// Navigate to the single view for an image
function navigateToSingleView(index) {
    currentCollectionIndex = index ?? currentCollectionIndex;
    window.location.href = `inspect/${images[currentCollectionIndex]}`;
}

// Load initial collections
loadCollections();

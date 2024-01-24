// seam.js

document.getElementById('seamCarveButton').addEventListener('click', function() {
    let slider = document.getElementById('seamCarveSlider');
    slider.style.display = slider.style.display === 'none' ? 'block' : 'none';
    let image = document.getElementById('imagePreview');
    slider.max = image.naturalWidth;  // Use naturalWidth for the original image size
    slider.value = image.naturalWidth; // Reset slider position
    document.getElementById('currentWidth').textContent = slider.value; // Set initial width
});

document.getElementById('seamCarveSlider').addEventListener('input', function() {
    let seams_to_remove = this.max - this.value;
    let image = document.getElementById('imagePreview');
    document.getElementById('currentWidth').textContent = this.value; // Update width indicator

    fetch('/manipulate/seam_carve', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: image.src, seams_to_remove: seams_to_remove })
    })
    .then(response => response.json())
    .then(data => {
        image.src = data.img_data; // Update the image preview with the seam carved image
    })
    .catch(error => console.error('Error:', error));
});

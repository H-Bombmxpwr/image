// seam.js

let initialSliderValue;  // Variable to store the initial slider value

document.getElementById('seamCarveButton').addEventListener('click', function() {
    let slider = document.getElementById('seamCarveSlider');
    let image = document.getElementById('imagePreview');
    let currentWidthDisplay = document.getElementById('currentWidth');

    // Check if the slider is currently not displayed
    if (slider.style.display === 'none') {
        alert('Please note: Seam carving is a one-way process and cannot be undone.');
        slider.max = image.naturalWidth;  // Use naturalWidth for the original image size
        slider.value = image.naturalWidth; // Reset slider position to the max width
        initialSliderValue = image.naturalWidth; // Set initialSliderValue when button is clicked
        currentWidthDisplay.textContent = slider.value + 'px'; // Set initial width text
        slider.style.display = 'block'; // Show the slider
    } else {
        slider.style.display = 'none'; // Hide the slider
        currentWidthDisplay.textContent = ''; // Clear the width text
    }
});

document.getElementById('seamCarveSlider').addEventListener('input', function() {
    let slider = document.getElementById('seamCarveSlider');
    let currentSliderValue = parseInt(slider.value);

    if (currentSliderValue > initialSliderValue) {
        // Prevent the slider from moving to the right
        slider.value = initialSliderValue;
        return;  // Exit the function early
    }

    let seams_to_remove = initialSliderValue - currentSliderValue;
    let image = document.getElementById('imagePreview');
    document.getElementById('currentWidth').textContent = currentSliderValue + 'px'; // Update width text

    // Only perform seam carving if the slider has been moved to the left
    if (currentSliderValue < initialSliderValue) {
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
            // Update the initial slider value to the current value after carving
            initialSliderValue = currentSliderValue;
        })
        .catch(error => console.error('Error:', error));
    }
});

let isResampleActive = false;

document.getElementById('resampleButton').addEventListener('click', function() {
    // Get the resample input elements and the update button
    var resampleWidthInput = document.getElementById('resampleWidthInput');
    var resampleHeightInput = document.getElementById('resampleHeightInput');
    var resampleUpdateButton = document.getElementById('resampleUpdateButton');

    // Toggle the resample input visibility and the update button
    isResampleActive = !isResampleActive;
    resampleWidthInput.style.display = isResampleActive ? 'inline' : 'none';
    resampleHeightInput.style.display = isResampleActive ? 'inline' : 'none';
    resampleUpdateButton.style.display = isResampleActive ? 'inline' : 'none';

    // Clear the inputs if we're hiding them
    if (!isResampleActive) {
        resampleWidthInput.value = '';
        resampleHeightInput.value = '';
    }
});

document.getElementById('resampleUpdateButton').addEventListener('click', function() {
    var resampleWidthInput = document.getElementById('resampleWidthInput');
    var resampleHeightInput = document.getElementById('resampleHeightInput');
    var imagePreview = document.getElementById('imagePreview');

    var width = parseInt(resampleWidthInput.value);
    var height = parseInt(resampleHeightInput.value);

    // Validation for width and height input
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        alert("Please enter a valid width and height.");
        return;
    }

    // Send the resample request to the backend
    fetch('/manipulate/resample', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: imagePreview.src,
            width: width,
            height: height
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.img_data) {
            // Update the image preview with the new resampled image
            imagePreview.src = data.img_data;
            // Hide the input fields and the update button after successful resample
            resampleWidthInput.style.display = 'none';
            resampleHeightInput.style.display = 'none';
            document.getElementById('resampleUpdateButton').style.display = 'none';
            isResampleActive = false;
        } else {
            alert('Error resampling image. Please try again.');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Failed to resample image.');
    });
});

// cropper_init.js
let cropper;
let isCropActive = false;

document.getElementById('cropButton').addEventListener('click', function() {
    var imagePreview = document.getElementById('imagePreview');
    isCropActive = !isCropActive;

    if (isCropActive) {
        // Initialize Cropper.js if not already active
        if (!cropper) {
            cropper = new Cropper(imagePreview, {
                viewMode: 1, // Contain the crop box within the canvas
                dragMode: 'move', // Allow moving the image within the crop box
                autoCropArea: 1, // Automatically adjust the crop box to the size of the image
                restore: false, // Do not restore the cropped area after resize
                guides: true, // Show the dashed lines for guiding
                center: true, // Show the center indicator
                highlight: false, // Do not highlight the crop box area
                cropBoxMovable: true, // Allow moving the crop box
                cropBoxResizable: true, // Allow resizing the crop box
                toggleDragModeOnDblclick: false, // No toggling drag mode on double click
            });
        }
        document.getElementById('cutButton').style.display = 'block';
    } else {
        // Destroy Cropper instance if active
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        document.getElementById('cutButton').style.display = 'none';
    }
});

document.getElementById('cutButton').addEventListener('click', function() {
    if (!cropper) {
        return;
    }

    // Get the cropped image data and replace the preview with it
    cropper.getCroppedCanvas().toBlob(function(blob) {
        // Update the preview image
        var url = URL.createObjectURL(blob);
        imagePreview.src = url;

        // Reset cropper for the next action
        cropper.destroy();
        cropper = null;

        // Hide the "Cut" button until "Crop" is clicked again
        document.getElementById('cutButton').style.display = 'none';
    });
});

// Add logic for "Save" and "Convert" buttons as well


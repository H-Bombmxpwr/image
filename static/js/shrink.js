let isShrinkExpandActive = false;

document.getElementById('shrinkButton').addEventListener('click', function() {
    var imagePreview = document.getElementById('imagePreview');
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    // When the button is clicked, update the image data with the displayed size
    if (isShrinkExpandActive) {
        canvas.width = imagePreview.offsetWidth;
        canvas.height = imagePreview.offsetHeight;
        ctx.drawImage(imagePreview, 0, 0, canvas.width, canvas.height);
        imagePreview.src = canvas.toDataURL(); // Update the image's src to the resized image
    }

    // Toggle the resize functionality
    var container = document.getElementById('imageContainer');
    var handle = document.getElementById('resizeHandle');
    
    isShrinkExpandActive = !isShrinkExpandActive;
    container.style.resize = isShrinkExpandActive ? 'both' : 'none';
    handle.style.display = isShrinkExpandActive ? 'block' : 'none';
});




document.getElementById('imageInput').addEventListener('change', function() {
     // Hide the resize handle initially when a new image is uploaded
     var handle = document.getElementById('resizeHandle');
     handle.style.display = 'none'; // Hide the handle
    if (this.files && this.files[0]) {
        var fileType = this.files[0].type.split('/')[1].toUpperCase();
        document.getElementById('fileType').textContent = fileType;

        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            updateDimensions();
        };
        reader.readAsDataURL(this.files[0]);
    }
});

var resizeObserver = new ResizeObserver(function(entries) {
    for (let entry of entries) {
        updateDimensions();
    }
});

resizeObserver.observe(document.getElementById('imageContainer'));

function updateDimensions() {
    var image = document.getElementById('imagePreview');
    document.getElementById('width').textContent = image.offsetWidth;
    document.getElementById('height').textContent = image.offsetHeight;
}

// Clear initial dimensions
document.getElementById('width').textContent = '';
document.getElementById('height').textContent = '';
document.getElementById('fileType').textContent = '';


document.getElementById('imageContainer').addEventListener('mouseup', function() {
    if (!isShrinkExpandActive) return;

    var imagePreview = document.getElementById('imagePreview');
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = imagePreview.offsetWidth;
    canvas.height = imagePreview.offsetHeight;
    ctx.drawImage(imagePreview, 0, 0, canvas.width, canvas.height);
    imagePreview.src = canvas.toDataURL(); // Update the image's src to the resized image
});


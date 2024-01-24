let isShrinkExpandActive = false;

document.getElementById('shrinkButton').addEventListener('click', function() {
    var container = document.getElementById('imageContainer');
    var handle = document.getElementById('resizeHandle');
    
    isShrinkExpandActive = !isShrinkExpandActive;
    container.style.resize = isShrinkExpandActive ? 'both' : 'none';
    handle.style.display = isShrinkExpandActive ? 'block' : 'none'; // Toggle handle visibility
});



document.getElementById('imageInput').addEventListener('change', function() {
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

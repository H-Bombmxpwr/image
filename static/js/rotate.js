// JavaScript file (e.g., script.js or a new rotate.js)

document.getElementById('rotateButton').addEventListener('click', function() {
    // Toggle the rotate input box
    let rotateInput = document.getElementById('rotateInput');
    rotateInput.style.display = rotateInput.style.display === 'none' ? 'block' : 'none';
    rotateInput.value = ''; // Reset the input value
});

let currentDegrees = 0;

document.getElementById('rotateInput').addEventListener('input', function() {
    let degrees = parseInt(this.value);
    let imagePreview = document.getElementById('imagePreview');
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    // Load the image into the canvas and apply rotation
    let img = new Image();
    img.onload = function() {
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Perform rotation
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees - currentDegrees) * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        
        // Update the image preview and the current rotation
        imagePreview.src = canvas.toDataURL();
        currentDegrees = degrees;
    };
    img.src = imagePreview.src;  // Use the current src as the base for rotation
});


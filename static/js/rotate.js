// JavaScript file (e.g., script.js or a new rotate.js)

document.getElementById('rotateButton').addEventListener('click', function() {
    // Toggle the rotate input box
    let rotateInput = document.getElementById('rotateInput');
    rotateInput.style.display = rotateInput.style.display === 'none' ? 'block' : 'none';
    rotateInput.value = ''; // Reset the input value
});

document.getElementById('rotateInput').addEventListener('input', function() {
    let imagePreview = document.getElementById('imagePreview');
    let degrees = this.value;
    
    // Rotate the image preview
    imagePreview.style.transform = `rotate(${-degrees}deg)`;
});

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('seamCarveSlider').style.display = 'none';
});


function manipulateImage(action) {
    const image = document.getElementById('imageInput').files[0];
    if (!image) {
        alert("Please upload an image first.");
        return;
    }

    const formData = new FormData();
    formData.append('image', image);

    fetch(`/manipulate/${action}`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.blob())
    .then(blob => {
        const imageURL = URL.createObjectURL(blob);
        
    })
    .catch(error => console.error('Error:', error));
}
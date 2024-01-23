document.getElementById('cropButton').addEventListener('click', () => {
    manipulateImage('crop');
});

document.getElementById('seamCarveButton').addEventListener('click', () => {
    manipulateImage('seam_carve');
});

document.getElementById('saturationButton').addEventListener('click', () => {
    manipulateImage('saturation');
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
        document.getElementById('displayedImage').src = imageURL;
    })
    .catch(error => console.error('Error:', error));
}

document.getElementById('uploadButton').addEventListener('click', () => {
    document.getElementById('imageInput').click();
});

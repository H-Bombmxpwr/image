let cropper;
document.getElementById('imageInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';

        if (cropper) {
            cropper.destroy();
        }

        cropper = new Cropper(document.getElementById('imagePreview'), {
            aspectRatio: 16 / 9, // or whatever aspect ratio you want
            crop(event) {
                console.log(event.detail.x);
                console.log(event.detail.y);
                console.log(event.detail.width);
                console.log(event.detail.height);
            },
        });
    };
    reader.readAsDataURL(file);
});


document.getElementById('cropButton').addEventListener('click', function() {
    const canvas = cropper.getCroppedCanvas();
    canvas.toBlob(function(blob) {
        // Now you can send this blob to the server...
        // For example, using FormData and fetch:
        const formData = new FormData();
        formData.append('croppedImage', blob);

        fetch('/manipulate/crop', {
            method: 'POST',
            body: formData,
        }).then(response => {
            // Handle the response from the server here
        });
    });
});

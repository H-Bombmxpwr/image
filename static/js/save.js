document.getElementById('saveButton').addEventListener('click', function() {
    var image = document.getElementById('imagePreview');
    var imgData = image.src;
    var filename = document.getElementById('filenameInput').value || 'downloadedImage';

    if (imgData) {
        var downloadLink = document.createElement('a');
        downloadLink.href = imgData;
        downloadLink.download = filename + '.jpg'; // Append '.jpg' to the filename

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
});

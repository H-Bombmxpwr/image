function previewImage() {
    var input = document.getElementById('imageInput');
    var previewSection = document.getElementById('previewSection');
    var imagePreview = document.getElementById('imagePreview');
    
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            previewSection.style.display = 'block';
            document.getElementById('resizeSection').style.display = 'none'; // Hide resize tools initially
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function previewImage() {
    var input = document.getElementById('imageInput');
    var previewSection = document.getElementById('previewSection');
    var imagePreview = document.getElementById('imagePreview');
    
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            previewSection.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

let isResizing = false;

document.getElementById('resizeHandle').addEventListener('mousedown', function(e) {
    if (isShrinkExpandActive) {
        e.preventDefault();
        isResizing = true;
    }
});

document.addEventListener('mousemove', function(e) {
    if (isResizing && isShrinkExpandActive) {
        const container = document.getElementById('imageContainer');
        const width = e.clientX - container.getBoundingClientRect().left;
        const height = e.clientY - container.getBoundingClientRect().top;
        container.style.width = width + 'px';
        container.style.height = height + 'px';
    }
});

document.addEventListener('mouseup', function(e) {
    isResizing = false;
});

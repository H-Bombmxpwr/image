from flask import Flask, request, send_file, render_template, flash, redirect, url_for
from PIL import Image
import base64
import io
import os
from src.crop_utils import crop_image

app = Flask(__name__)
@app.route('/')
def home():
    if request.method == 'POST':
        if 'image' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['image']
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file:
            img = Image.open(file.stream)
            # Restrict to a specific size, e.g., 800x800 pixels
            max_size = (800, 800)
            img.thumbnail(max_size)
            
            # Save the image to a buffer
            buf = io.BytesIO()
            img.save(buf, format='JPEG')
            buf.seek(0)
            
            # Get the base64 representation for inclusion in the webpage
            data = base64.b64encode(buf.read()).decode('ascii')
            return render_template("index.html", img_data=data)
    return render_template("index.html")


@app.route('/manipulate/crop', methods=['POST'])
def crop_image():
    if 'croppedImage' not in request.files:
        return 'No file uploaded for cropping', 400

    file = request.files['croppedImage']
    img = Image.open(file.stream)

    # Perform cropping using PIL here if necessary
    # ...

    # Then save the cropped image to a BytesIO buffer and send it back
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    buf.seek(0)
    return send_file(buf, mimetype='image/jpeg')


@app.route('/manipulate/seam_carve', methods=['POST'])
def seam_carve_image():
    # Implement seam carving logic here
    return send_file(io.BytesIO(modified_image), mimetype='image/jpeg')

@app.route('/manipulate/saturation', methods=['POST'])
def adjust_saturation():
    # Implement saturation adjustment logic here
    return send_file(io.BytesIO(modified_image), mimetype='image/jpeg')

if __name__ == '__main__':
    app.run(debug=True)

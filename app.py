from flask import Flask, request, send_file, render_template, flash, redirect, url_for,jsonify
from PIL import Image,ImageOps
import base64
import io
import os
import numpy as np
from src.crop_utils import crop_image
import seam_carving

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
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    buf.seek(0)
    return send_file(buf, mimetype='image/jpeg')


@app.route('/manipulate/seam_carve', methods=['POST'])
def seam_carve_image():
    data = request.get_json()
    image_data = data['image'].split(",")[1]  # Remove the base64 prefix
    seams_to_remove = int(data['seams_to_remove'])

    # Decode the base64 image and create an in-memory stream
    image_stream = io.BytesIO(base64.b64decode(image_data))
    img = Image.open(image_stream).convert('RGB')  # Convert image to RGB
    src = np.array(img)

    # Calculate the new width after removing the seams
    new_width = src.shape[1] - seams_to_remove
    dst = seam_carving.resize(src, (new_width, src.shape[0]), energy_mode='backward', order='width-first')

    # Convert the carved numpy array back to a PIL Image
    carved_img = Image.fromarray(dst)

    # Convert the carved image to base64 for transmission
    buffered = io.BytesIO()
    carved_img.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    return jsonify({'img_data': f"data:image/jpeg;base64,{img_str}"})


@app.route('/manipulate/resize', methods=['POST'])
def resize_image():
    data = request.get_json()
    image_data = data['image'].split(",")[1]  # Remove the base64 prefix
    scale = float(data['scale']) / 50  # Adjust scale based on slider value

    # Decode the base64 image
    image = Image.open(io.BytesIO(base64.b64decode(image_data)))

    # Resize the image
    new_size = (int(image.width * scale), int(image.height * scale))
    image = ImageOps.fit(image, new_size, Image.ANTIALIAS)

    # Convert back to base64
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    return jsonify({'img_data': f"data:image/jpeg;base64,{img_str}"})

@app.route('/save_image', methods=['POST'])
def save_image():
    image_data = request.json.get('image')
    if not image_data:
        return jsonify({'error': 'No image data provided'}), 400

    # Decode the base64 image
    image_data = image_data.split(",")[1]  # Remove the base64 prefix
    image = base64.b64decode(image_data)
    
    # Save the image
    filename = 'saved_image.jpg'  # You can generate a unique filename here
    with open(os.path.join('saved_images', filename), 'wb') as f:
        f.write(image)
    
    return jsonify({'message': 'Image saved successfully'}), 200

@app.route('/convert_image', methods=['POST'])
def convert_image():
    # Handle the conversion between different image formats
    return "hello"

if __name__ == '__main__':
    app.run(debug=True)

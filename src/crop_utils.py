from PIL import Image

def crop_image(image, crop_data):
    # crop_data is a dictionary with keys 'x', 'y', 'width', 'height'
    cropped_image = image.crop((crop_data['x'], crop_data['y'], crop_data['x'] + crop_data['width'], crop_data['y'] + crop_data['height']))
    return cropped_image

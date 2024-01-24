from PIL import Image
import seam_carving

class SeamCarver:
    def __init__(self, image_stream):
        self.img = Image.open(image_stream).convert('RGB')  # Ensure the image is in RGB format

    def carve_seam(self, seams_to_remove):
        # Convert PIL Image to numpy array
        img_array = np.array(self.img)

        # Initialize the seam carving object from the library
        sc = SC(img_array)

        # Carve the specified number of seams
        carved_array = sc.resize((self.img.width - seams_to_remove, self.img.height))
        
        # Convert carved numpy array back to PIL Image
        self.processed_img = Image.fromarray(carved_array)

    def get_carved_image(self):
        # Just return the processed image
        return self.processed_img

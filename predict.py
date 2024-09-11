import numpy as np
import tensorflow as tf
from keras.preprocessing import image
from keras.applications.vgg16 import VGG16, preprocess_input, decode_predictions

def load_and_prep_image(img_path):
 """
 Loads and preprocesses an image from the given path.
 """
 img = image.load_img(img_path, target_size=(224, 224))
 img_array = image.img_to_array(img)
 img_array = np.expand_dims(img_array, axis=0)
 preprocessed_img = preprocess_input(img_array)
 return preprocessed_img

def classify_image(img_path, model):
 """
 Classifies an image using the given model.
 """
 prepped_image = load_and_prep_image(img_path)
 prediction = model.predict(prepped_image)
 return decode_predictions(prediction, top=3)[0]

# Load a pre-trained VGG16 model
model = VGG16()

# Example usage
img_path = 'airplane.jpg'  # Replace with your image path
predictions = classify_image(img_path, model)
for _, label, probability in predictions:
    print(f"{label}: {probability:.2f}%")

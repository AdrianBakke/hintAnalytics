# HINT ANALYTICS

Are there any good opensource analytics platform for deeplearning out there?

This tool is my substitute until i find somthing better. Should be fun

what i want:
* access to view and review data and model prediction, while also having access to metrics for model at the same place
* should be easy to customize to ones purpose, like if you are reviewing data and would like to create or fix labels etc

plan:
* i don`t think this should be to much work: setup a webinterface, find a good solution for how to structure the data and how to show it
* keep as simple as possible with very simple UI

TODO:
* create view for images with labels/predictions
* create training loss overview
* search for image
* run model on current image and display results
* create a sqlite db with image paths, labels for image, ?prediction?
* add file with path to data and insert all paths to db, then we make thumbnails for different datasources for easy navigation


to run:

`bash python server.js`

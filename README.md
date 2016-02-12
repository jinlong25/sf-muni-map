# To-do

  * Allow selecting multiple routes
   
   Implmenting multiple route initialization and updating. Replacing select box with text search bar.

  * Determine if a bus is in service or out of service
   
   Using turf.js to calculate line buffer of routes and decide if each bus is within buffer and style out-of-service bus differently.

  * Using true route to tween bus locations between points
   
   Using routing API from mapbox.com to calculate route between points and then use the route, instead of a simple straight line to tween bus location.

  * Change point size when it moves
   
   Add visual emphasis to moving points by increasing it size. Point will set back to original size when move ends.

  * Handling enter and exit when number of buses changes
   
   Dynamically enter and exit buses (points) when the number of buses changes between AJAX call.

# Reference
[1] D3 + Leaflet by Mike Bostock (https://bost.ocks.org/mike/leaflet/)

[2] Leaflet map with d3.js elements that are overlaid on a map by d3noob (http://www.d3noob.org/2014/03/leaflet-map-with-d3js-elements-that-are.html)

[3] Taxi Techblog 2: Leaflet, D3, and other Frontend Fun by Chris Whong (http://chriswhong.com/open-data/taxi-techblog-2-leaflet-d3-and-other-frontend-fun/)

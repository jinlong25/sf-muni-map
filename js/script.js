//define mapbox token
L.mapbox.accessToken = 'pk.eyJ1IjoiamlubG9uZyIsImEiOiJhMWUzNzk1MTEyNTUyNzkyNzBjZWUzYWMwODM2ZjgyZiJ9.youixT7oBlwLEwXC9q3P3w';

var geojson = {
	"type": "FeatureCollection",
	"features": [
		{
			"type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          -122.394494486, 37.787303162]
      }
    },
		{
			"type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-122.392949898, 37.786072479]
    	}
		}
	]
};

//set sf bbox
var sf = {
	"type": "FeatureCollection",
	"features": [
		{
			"type": "Feature",
			"geometry": {
				"type": "Point",
				"coordinates": [-122.515149, 37.812780]
			}
		},
		{
			"type": "Feature",
			"geometry": {
				"type": "Point",
				"coordinates": [-122.352600, 37.712321]
			}
		}
	]
}

//setup map
var map = L.mapbox.map('map', 'mapbox.dark')
	.setView([37.7833, -122.4167], 13);

//create svg
var svg = d3.select(map.getPanes().overlayPane).append('svg');
var g = svg.append('g').attr('class', 'leaflet-zoom-hide');

//define transform function
var transform = d3.geo.transform({ point: projectPoint });
var path = d3.geo.path().projection(transform).pointRadius(8);

//draw points
var features = g.selectAll('path')
	.data(geojson.features)
	.enter().append('path')
	.style('fill', 'yellow')
	.style('stroke', '#888');

map.on('viewreset', reset);
reset();

function reset() {
	//get bbox
	var bounds = path.bounds(sf),
	    topLeft = bounds[0],
	    bottomRight = bounds[1];

	//define svg dimensions
	svg.attr("width", bottomRight[0] - topLeft[0])
	  .attr("height", bottomRight[1] - topLeft[1])
	  .style("left", topLeft[0] + "px")
	  .style("top", topLeft[1] + "px");

	//translate g element to align with basemap
	g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

	//update path
	features.attr('d', path);
}

//project spatial features to mapbox map
function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}
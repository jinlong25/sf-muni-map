//define mapbox token
L.mapbox.accessToken = 'pk.eyJ1IjoiamlubG9uZyIsImEiOiJhMWUzNzk1MTEyNTUyNzkyNzBjZWUzYWMwODM2ZjgyZiJ9.youixT7oBlwLEwXC9q3P3w';

var PointScaleReference = {
		10: '0.05',
		11: '0.2',
		12: '0.5',
		13: '3',
		14: '3.5',
		15: '4',
		16: '4.2',
		17: '6',
		18: '8',
		19: '9',
		20: '9',
		21: '9',
		22: '9'
}

//set sf bbox
var sf = {
	'type': 'FeatureCollection',
	'features': [
		{
			'type': 'Feature',
			'geometry': {
				'type': 'Point',
				'coordinates': [-122.515149, 37.812780]
			}
		},
		{
			'type': 'Feature',
			'geometry': {
				'type': 'Point',
				'coordinates': [-122.352600, 37.712321]
			}
		}
	]
}

var features;

//setup map
var map = L.mapbox.map('map', 'mapbox.dark')
	.setView([37.756646, -122.449066], 13);

//create svg
var svg = d3.select(map.getPanes().overlayPane).append('svg');
var g = svg.append('g').attr('class', 'leaflet-zoom-hide');

//define transform function
var transform = d3.geo.transform({ point: projectPoint });
var path = d3.geo.path().projection(transform);

//define function that generate lines
var makeLine = d3.svg.line()
	.interpolate('linear')
	.x(function(d) {
			return applyLatLngToLayer(d).x
	})
	.y(function(d) {
			return applyLatLngToLayer(d).y
	});

//retrieve data
$.ajax({
	type: 'GET',
	dataType: 'xml',
	url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=N&t=0',
	success: function(xml, textStatus) { //TODO add error handling case
		//refactor vehicle info into GeoJSON
		var geojson = parsingXML(xml);
		console.log(geojson.features.length + ' buses');

		//draw points
		features = g.selectAll('path')
			.data(geojson.features)
			.enter().append('path')
			.attr('class', 'bus')
			.attr('id', function(d) {
				return d.properties.busId;
			})
			.attr('lon', function(d) {
				return d.geometry.coordinates[0];
			})
			.attr('lat', function(d) {
				return d.geometry.coordinates[1];
			})//TODO add more attrs
			.style('fill', 'yellow')
			.style('opacity', 0.5)
			.style('stroke', '#888');

		map.on('viewreset', reset);
		reset();

		function reset() {
			//get bbox
			var bounds = path.bounds(sf),
			    topLeft = bounds[0],
			    bottomRight = bounds[1];

			//define svg dimensions
			svg.attr('width', bottomRight[0] - topLeft[0])
			  .attr('height', bottomRight[1] - topLeft[1])
			  .style('left', topLeft[0] + 'px')
			  .style('top', topLeft[1] + 'px');

			//translate g element to align with basemap
			g.attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');

			//update path
			path.pointRadius(PointScaleReference[map.getZoom()]);
			features.attr('d', path);

			console.log(map.getZoom());
		}
	}
});

function updateLocation() {
	$.ajax({
		type: 'GET',
		dataType: 'xml',
		url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=N&t=0',
		success: function(xml, textStatus) {
			updatedGeoJSON = parsingXML(xml);

			features.data(updatedGeoJSON.features)
				.attr('lon', function(d) {
					return d.geometry.coordinates[0];
				})
				.attr('lat', function(d) {
					return d.geometry.coordinates[1];
				})//TODO add more attrs
				.transition()
				.duration(5000)
				.attr('d', path);
		}
	});
}

setInterval(updateLocation, 5000);
// setTimeout(updateLocation, 5000);

function transition(path) {
    path.transition()
        .duration(7500)
        .attrTween('stroke-dasharray', tweenDash);
}

function tweenDash() {
	var l = path.node().getTotalLength();
	return function(t) {
		var marker = d3.select('#marker');
		var p = path.node().getPiontAtLength(t * l);
		marker.attr('transform', 'translate(' + p.x + ',' + p.y + ')');
		return 'black';
	}
}

//project spatial features to mapbox map
function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

//project piont to layer
function applyLatLngToLayer(d) {
    var y = d.geometry.coordinates[1]
    var x = d.geometry.coordinates[0]
    return map.latLngToLayerPoint(new L.LatLng(y, x))
}

//parsing XML response into GeoJSON objects
function parsingXML(xml) {
	var output = {
		'type': 'FeatureCollection',
		'features': []
	};

	var vehicles = $(xml).find('vehicle');

	vehicles.each(function(i, e) {
		d = {
			'type': 'Feature',
			'geometry': {
				'type': 'Point',
				'coordinates': []
			},
			'properties': {}
		};
		d.geometry.coordinates = [$(e).attr('lon'), $(e).attr('lat')];
		d.properties.busId = $(e).attr('id');
		d.properties.routeTag = $(e).attr('routeTag');
		d.properties.dirTag = $(e).attr('routeTag');
		d.properties.secsSinceReport = $(e).attr('secsSinceReport');
		d.properties.predictable = $(e).attr('predictable');
		d.properties.heading = $(e).attr('heading');
		d.properties.speedKmHr = $(e).attr('speedKmHr');
		d.properties.leadingVehicleId = $(e).attr('leadingVehicleId');
		output.features.push(d);
	});

	return output;
}
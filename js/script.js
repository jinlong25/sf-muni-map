//define mapbox token
L.mapbox.accessToken = 'pk.eyJ1IjoiamlubG9uZyIsImEiOiJhMWUzNzk1MTEyNTUyNzkyNzBjZWUzYWMwODM2ZjgyZiJ9.youixT7oBlwLEwXC9q3P3w';

var PointScaleReference = {
		10: '0.05',
		11: '0.2',
		12: '0.5',
		13: '1.9',
		14: '2.8',
		15: '3.5',
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

//setup map
var map = L.mapbox.map('map', 'mapbox.dark')
	.setView([37.756646, -122.449066], 13);

//create svg
var svg = d3.select(map.getPanes().overlayPane).append('svg');
var g = svg.append('g').attr('class', 'leaflet-zoom-hide');

//define transform function
var transform = d3.geo.transform({ point: projectPoint });
var path = d3.geo.path().projection(transform);

var busGeo = {
	'type': 'FeatureCollection',
	'features': []
};

//retrieve data
$.ajax({
	type: 'GET',
	dataType: 'xml',
	url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=N&t=0',
	success: function(xml, textStatus) { //TODO add error handling case
		//extracting all vehicle info
		var buses = $(xml).find('vehicle');

		//refactor vehicle info into GeoJSON
		buses.each(function(i, e) {
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
			busGeo.features.push(d);
		});

		//draw points
		var features = g.selectAll('path')
			.data(busGeo.features)
			.enter().append('path')
			.attr('class', 'bus')
			.attr('id', function(d) {
				return d.properties.busId;
			}) //TODO add more attrs
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
			svg.attr('width', bottomRight[0] - topLeft[0])
			  .attr('height', bottomRight[1] - topLeft[1])
			  .style('left', topLeft[0] + 'px')
			  .style('top', topLeft[1] + 'px');

			//translate g element to align with basemap
			g.attr('transform', 'translate(' + -topLeft[0] + ',' + -topLeft[1] + ')');

			//update path
			path.pointRadius(PointScaleReference[map.getZoom()]);
			features.attr('d', path);
		}
	}
});

function updateLocation() {
	$.ajax({
		type: 'GET',
		dataType: 'xml',
		url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=N&t=0',
		success: function(xml, textStatus) {
			var buses = $(xml).find('vehicle');

			//refactor vehicle info into GeoJSON
			buses.each(function(i, e) {
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
				busGeo.features.push(d);
			});

			//update bus locations
			busGeo.features.forEach(function(d) {
				if(d.properties.secsSinceReport < 10) {
					d3.select('.bus[id="' + d.properties.busId + '"]')
						.style('fill', 'red')
						.transition()
						.duration(10000)
						.attr('d', path);
					console.log(d.properties.busId + ' updated');
				}
			});
		}
	});
}

setInterval(updateLocation, 30000);

//project spatial features to mapbox map
function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}
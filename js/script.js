//define mapbox token
L.mapbox.accessToken = 'pk.eyJ1IjoiamlubG9uZyIsImEiOiJhMWUzNzk1MTEyNTUyNzkyNzBjZWUzYWMwODM2ZjgyZiJ9.youixT7oBlwLEwXC9q3P3w';

//define vars
var locs,
	route,
	routeTag = 'F',
	routeList,
	locGeoJSON,
	routeGeoJSON,
	currentZoomLevel = 13;

//define point size at all zoom scales
var PointScaleReference = {10: '0.05', 11: '0.2', 12: '0.5', 13: '3', 14: '3.5', 15: '4', 16: '4.2', 17: '6', 18: '8', 19: '9', 20: '9',21: '9', 22: '9'}

//set sf bbox
var sf = { 'type': 'FeatureCollection', 'features': [ { 'type': 'Feature', 'geometry': { 'type': 'Point', 'coordinates': [-122.515149, 37.812780] } },
{ 'type': 'Feature', 'geometry': { 'type': 'Point', 'coordinates': [-122.352600, 37.712321] } } ] }

//setup map
var map = L.mapbox.map('map', 'mapbox.dark')
	.setView([37.756646, -122.449066], currentZoomLevel);

//create svg
var svg = d3.select(map.getPanes().overlayPane).append('svg');
var g = svg.append('g').attr('class', 'leaflet-zoom-hide');

//define transform function
var transform = d3.geo.transform({ point: projectPoint });
var path = d3.geo.path().projection(transform);

//retrieve route list
$.ajax({
	type: 'GET',
	dataType: 'xml',
	url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=sf-muni',
	success: function(xml, textStatus) { //TODO add error handling case
		//parse route list
		routeList = parsingRouteList(xml);
		console.log(routeList);

		//populate route list into select box
		var routeSelection = d3.select('#route_selection');
		routeSelection.selectAll('option')
			.data(routeList)
			.enter().append('option')
			.attr('value', function(d) { return d[0]; })
			.text(function(d) { return d[1]; });

		//update route
		d3.select('#route_selection').on('change', function() {
			//remove all buses and route
			d3.selectAll('.bus').remove();
			d3.selectAll('.route').remove();

			//re-initialize buses and route
			var options = document.getElementById('route_selection');
			routeTag = options.options[options.selectedIndex].value;

			initializeVehicleLocation(routeTag);
		});
	}
});

//retrieve data
initializeVehicleLocation(routeTag);

//update vehicle locations every xx seconds
setInterval(function() {
	updateVehicleLocation(routeTag)
}, 5000);
// setTimeout(updateLocation, 3000);

//define retrieve data function
function initializeVehicleLocation(routeTag) {
	$.when(
		//retrieve vehicle location data
		$.ajax({
			type: 'GET',
			dataType: 'xml',
			url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=' + routeTag + '&t=0',
			success: function(xml, textStatus) { //TODO add error handling case
				//refactor vehicle info into GeoJSON
				locGeoJSON = parsingVehicleLoc(xml);
				console.log(locGeoJSON.features.length + ' buses');
			}
		}),

		//retrieve route data
		$.ajax({
			type: 'GET',
			dataType: 'xml',
			url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni&r=' + routeTag,
			success: function(xml, textStatus) { //TODO add error handling case
				//parse route response
				routeGeoJSON = parsingRoute(xml);
			}
		})
	).then(function() {//all data ready at this point
		//draw route
		route = g.selectAll('path.route')
			.data(routeGeoJSON.features)
			.enter().append('path')
			.attr('class', 'route');

		//draw points
		locs = g.selectAll('path.bus')
			.data(locGeoJSON.features, function(d) {
				return d.properties.busId;
			})
			.enter().append('path')
			.attr('class', 'bus')
			.attr('id', function(d) {
				return d.properties.busId;
			});

		//trigger reset on map viewreset
		map.on('viewreset', reset);
		reset();

		//define reset function to update map on viewrest
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
			locs.attr('d', path);
			route.attr('d', path);

			//print out zoom level for debugging
			console.log('Zoom level: ' + map.getZoom());
		}
	});
}

//update vehicle location
function updateVehicleLocation(routeTag) {
	$.ajax({
		type: 'GET',
		dataType: 'xml',
		url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=' + routeTag + '&t=0',
		success: function(xml, textStatus) {
			//parse vehicle new locations
			var updatedLocGeoJSON = parsingVehicleLoc(xml);
			// console.log(updatedLocGeoJSON.features.length + ' buses');
			console.log('updated');

			//update stored data
			updatedLocGeoJSON.features.forEach(function(d) {
				//get the current bus id
				var thisId = d.properties.busId;

				//search and append to stored data
				for(var i = 0; i < locGeoJSON.features.length; i++) {
					var thisProp = locGeoJSON.features[i].properties;
					if (thisId === thisProp.busId) {
						//update geometry
						locGeoJSON.features[i].geometry.coordinates = d.geometry.coordinates;

						//update properties
						thisProp.dirTag = d.properties.dirTag;
						thisProp.predictable = d.properties.predictable;
						thisProp.leadingVehicleId = d.properties.leadingVehicleId;
						thisProp.routeTag = d.properties.routeTag;
						thisProp.secsSinceReport = d.properties.secsSinceReport;
						thisProp.coords.push(d.properties.coords[0]);
						thisProp.heading.push(d.properties.heading[0]);
						thisProp.speedKmHr.push(d.properties.speedKmHr[0]);
						thisProp.timestamp.push(d.properties.timestamp[0]);
					}
					continue;
				}
			});

			//update data binding to the DOM
			locs.data(locGeoJSON.features, function(d) {
				return d.properties.busId;
			})
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

//project spatial features to mapbox map
function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}

//parsing XML response of vehicle locations into GeoJSON objects
function parsingVehicleLoc(xml) {
	var output = {
		'type': 'FeatureCollection',
		'features': []
	};

	var currentTimestamp = new Date().getTime() / 1000;

	var vehicles = $(xml).find('vehicle');

	vehicles.each(function(i, e) {
		var d = {
			'type': 'Feature',
			'geometry': {
				'type': 'Point',
				'coordinates': []
			},
			'properties': {}
		};
		d.geometry.coordinates = [$(e).attr('lon'), $(e).attr('lat')];
		d.properties.coords = [d.geometry.coordinates]
		d.properties.busId = $(e).attr('id');
		d.properties.routeTag = $(e).attr('routeTag');
		d.properties.dirTag = $(e).attr('routeTag');
		d.properties.secsSinceReport = $(e).attr('secsSinceReport');
		d.properties.predictable = $(e).attr('predictable');
		d.properties.heading = [$(e).attr('heading')];
		d.properties.speedKmHr = [$(e).attr('speedKmHr')];
		d.properties.leadingVehicleId = $(e).attr('leadingVehicleId');
		d.properties.timestamp = [currentTimestamp];
		output.features.push(d);
	});

	return output;
}

//parsing XML response of route info into a single GeoJSON object
function parsingRoute(xml) {
	var output = {
		'type': 'FeatureCollection',
		'features': []
	};

	var route = $(xml).find('path');
	route.each(function(i, e) {
		var d = {
			'type': 'Feature',
			'geometry': {
				'type': 'LineString',
				'coordinates': []
			}
		};

		var pts = $(e).find('point');
		pts.each(function(j, p) {
			d.geometry.coordinates.push([$(p).attr('lon'), $(p).attr('lat')]);
		});
		output.features.push(d);
	});

	return output;
}

//parsing XML response of route list info into a single GeoJSON object
function parsingRouteList(xml) {
	var output = [];

	var routeList = $(xml).find('route');
	routeList.each(function(i, e) {
		output.push([$(e).attr('tag'), $(e).attr('title')]);
	});

	return output;
}
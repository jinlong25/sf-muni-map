//define mapbox token
L.mapbox.accessToken = 'pk.eyJ1IjoiamlubG9uZyIsImEiOiJhMWUzNzk1MTEyNTUyNzkyNzBjZWUzYWMwODM2ZjgyZiJ9.youixT7oBlwLEwXC9q3P3w';

//define vars
var locs,
	route,
	bbox,
	routeTag = 'F',
	routeList,
	locGeoJSON,
	routeGeoJSON,
	speedLine,
	selectedBus,
	currentZoomLevel = 13,
	updateInterval = 5000,
	duration = 5000;


//define vars of speed chart
var sc = {
	w: 200,
	h: 50,
	top: 30,
	right: 10,
	bottom: 20,
	left: 30,
	duration: 1000,
	// xAxis,
	// yAxis,
	// numFormatter: d3.format(','),
	// dateParser: d3.time.format('%Y-%m-%d').parse,
	// tooltipDateParser: d3.time.format('%b.%e')
	line: d3.svg.line()
							.x(function(d) { return sc.x(d.time); })
							.y(function(d) { return sc.y(d.speed); })
							.interpolate('monotone')
};

//set sf bbox
var sf = { 'type': 'FeatureCollection', 'features': [ { 'type': 'Feature', 'geometry': { 'type': 'Point', 'coordinates': [-122.515149, 37.812780] } },
{ 'type': 'Feature', 'geometry': { 'type': 'Point', 'coordinates': [-122.352600, 37.652321] } } ] }

//setup map
var map = L.mapbox.map('map', 'mapbox.dark', {maxZoom: 16, minZoom: 12})
	.setView([37.756646, -122.449066], currentZoomLevel);
map.maxZoom = 14;

//create svg
var svg = d3.select(map.getPanes().overlayPane).append('svg');
var g = svg.append('g').attr('class', 'leaflet-zoom-hide');

//define transform function
var transform = d3.geo.transform({ point: projectPoint });
var path = d3.geo.path().projection(transform);

//retrieve route list
initializeRouteList();

//retrieve data
initializeVehicleLocation(routeTag);

//update vehicle locations every xx seconds
setTimeout(function() {
	updateVehicleLocation(routeTag)
}, 500);
setInterval(function() {
	updateVehicleLocation(routeTag)
}, updateInterval);


//create svg in info window
var canvas = d3.select('#speed_chart_window').append('svg')
	.attr('class', 'canvas')
	.attr('width', sc.w + sc.left + sc.right)
	.attr('height', sc.h + sc.top + sc.bottom)
	.append('g')
	.attr('transform', 'translate(' + sc.left + ',' + sc.top + ')');

//create a background for reference TODO remove
// canvas.append('rect')
// 	.attr('width', sc.w)
// 	.attr('height', sc.h)
// 	.style('fill', '#fff');

var speedChart = canvas.append('g').attr('class', 'speed-chart');

// ------------------------------------------------------------------------------------------------------------------------
// -----------------------------------------------------  functions -------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------
//define a function to retrieve route list to populate select box
function initializeRouteList() {
	$.ajax({
		type: 'GET',
		dataType: 'xml',
		url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=sf-muni',
		success: function(xml, textStatus) { //TODO add error handling case
			//parse route list
			routeList = parsingRouteList(xml);

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

				//remove speed line
				d3.selectAll('.speed-line').remove();

				//remove all axes
				d3.selectAll('.axis').remove();

				//re-initialize buses and route
				options = document.getElementById('route_selection');
				routeTag = options.options[options.selectedIndex].value;

				//call to initialize vehicle locations
				initializeVehicleLocation(routeTag);
			});
		}
	});
}

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
				var routeInfo = parsingRouteInfo(xml);
				d3.select('#route_name').text(routeInfo[2]);
				d3.select('#from_stop').text(routeInfo[0]);
				d3.select('#to_stop').text(routeInfo[1]);

				//set map view based on route
				bbox = turf.extent(routeGeoJSON);
				map.fitBounds([[bbox[1] - 0.025, bbox[0]], [bbox[3] + 0.025, bbox[2]]]);
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

		//update fleet size info
		d3.select('#fleet_size').text(locGeoJSON.features.length);

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
			path.pointRadius(3);

			locs.data(locGeoJSON.features, function(d) {
				return d.properties.busId;
			}).transition()
				.duration(250)
				.attr('d', path);

			route.attr('d', path);
		}

		//get selected bus data
		selectedBus = locGeoJSON.features[0]; //TODO get selected bus by click
		var selectedBusData = [];

		//compose data for speed chart
		for (var i = 0; i < selectedBus.properties.timestamp.length; i++) {
			d = {'time': selectedBus.properties.timestamp[i],
				'speed': selectedBus.properties.speedKmHr[i]
			}
			selectedBusData.push(d);
		}

		//define x/y scales
		sc.x = d3.time.scale()
			.range([0, sc.w])
			.domain([selectedBus.properties.timestamp[0],
				selectedBus.properties.timestamp.slice().pop()]);

		var maxSpeed = d3.max(selectedBus.properties.speedKmHr, function(d) { return d; }) * 1.5;
		sc.y = d3.scale.linear()
			.range([0, sc.h])
			// .domain([maxSpeed === 0 ? 100 : maxSpeed, 0]);
			.domain([100, 0]);

		//Draw speed line
		speedLine = speedChart.append('path')
			.attr('class', 'speed-line')
			.attr('d', sc.line(selectedBusData));

		//define axes
		sc.xAxis = d3.svg.axis().scale(sc.x).orient('bottom').ticks(2)
			.tickFormat(d3.time.format('%H:%M:%S'));

		sc.yAxis = d3.svg.axis().scale(sc.y).orient('left')
			.ticks(2)
			.tickFormat(function(d) { return d === 0 ? '' : d; });

		//draw axes
		canvas.append('g')
			.attr('class', 'x axis')
			.attr('transform', 'translate(0, ' + sc.h + ')')
			.call(sc.xAxis);

		canvas.append('g')
			.attr('class', 'y axis')
			.call(sc.yAxis);
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
				.transition()
				.duration(duration)
				.attr('d', path);

				//click to select selected bus
				d3.selectAll('.bus').on('click', function() {
					var selectedBusId = d3.select(this).attr('id');
					//dehightlight non-selected bus
					d3.selectAll('.bus').style('fill', 'red');
					d3.selectAll('.bus').style('stroke', 'yellow');

					//highlight selected bus
					d3.select(this).style('fill', 'yellow');
					d3.select(this).style('stroke', 'red');

					//update selected bus data
					for (var i = 0; i < locGeoJSON.features.length; i++) {
						if (locGeoJSON.features[i].properties.busId === selectedBusId) {
							selectedBus = locGeoJSON.features[i];
							updateSpeedLine(selectedBus);
						}
					}
				});

				updateSpeedLine(selectedBus);
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

	var currentTimestamp = new Date().getTime();

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

//parsing XML response of route to return begin and end stops
function parsingRouteInfo(xml) {
	var output = [];

	var stops = $(xml).find('route>stop');
	stops.each(function(i, e) {
		var stop = $(e).attr('title');
		output.push(stop);
	});

	var route = $(xml).find('route');
	var routeName = $(route).attr('title');

	return [output[0], output.pop(), routeName];
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

//update speed line
function updateSpeedLine(selectedBus) {
	//update the selected bus data
	selectedBusData = [];

	//compose data for speed chart
	for (var i = 0; i < selectedBus.properties.timestamp.length; i++) {
		d = {'time': selectedBus.properties.timestamp[i],
			'speed': selectedBus.properties.speedKmHr[i]
		}
		selectedBusData.push(d);
	}

	//update x/y scales
	sc.x.domain([selectedBus.properties.timestamp[0],
			selectedBus.properties.timestamp.slice().pop()]);

	// var maxSpeed = d3.max(selectedBus.properties.speedKmHr, function(d) { return d; }) * 1.5;
	// sc.y.domain([maxSpeed === 0 ? 100 : maxSpeed, 0]);

	//update speed line
	speedLine.transition()
		.duration(500)
		.attr('d', sc.line(selectedBusData));

	//update axes
	sc.xAxis.scale(sc.x);
	sc.yAxis.scale(sc.y);

	//update drawing axes
	d3.select('.x.axis')
		.transition()
		.duration(200)
		.call(sc.xAxis);
	d3.select('.y.axis')
		.transition()
		.duration(200)
		.call(sc.yAxis);
}
var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    fb = new Firebase("https://leads-poc.firebaseio.com"),
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer(osmUrl, {maxZoom: 18, attribution: osmAttrib}),
    map = new L.Map('map', {layers: [osm], center: new L.LatLng(40.7747314,-73.9653734), zoom: 15 }),
    markerRef = fb.child("markers"),
    selectionRef = fb.child("selections"),
    markers = {},
    selections = {};

L.MyFeatureGroup = L.FeatureGroup.extend({
    addLayer: function(layer) {
        //console.log('adding stamp ' + L.stamp(layer));
        //_.each(_.values(selections), function(m) { console.log(L.stamp(m)) })
        L.FeatureGroup.prototype.addLayer.call(this, layer);
    }
});


var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
    draw: {
        position: 'topleft',
        polygon: {
            title: 'Draw a sexy polygon!',
            allowIntersection: false,
            drawError: {
                color: '#b00b00',
                timeout: 1000
            },
            shapeOptions: {
                color: '#bada55'
            },
            showArea: true
        },
        polyline: false,
        circle: {
            shapeOptions: {
                color: '#662d91'
            }
        }
    },
    edit: {
        featureGroup: drawnItems
    }
});
map.addControl(drawControl);

map.on('draw:created', function (e) {
    //console.log('draw:created');
    var type = e.layerType,
        layer = e.layer;

    if (type === 'marker') {
        markerRef.push({
            coordinate: layer.getLatLng()
        });

    } else if (type === "circle") {
        layer.setStyle({fillColor: "#000000"});
        selectionRef.push({
            coordinate: layer.getLatLng(),
            radius: layer.getRadius(),
            options: layer.options
        });

    } else {
        selectionRef.push({
            coordinates: layer.getLatLngs(),
            options: layer.options
        });
    }
});

map.on('draw:edited', function () {
    e.layers.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
            var name = _.invert(markers)[layer];
            if (name) {
                markerRef.child(name).update({
                    coordinate: layer.getLatLng()
                });
            }
        } else if (layer instanceof L.Circle) {
            var name = _.invert(selections)[layer];
            if (name) {
                selectionRef.child(name).update({
                    coordinate: layer.getLatLng(),
                    radius: layer.getRadius(),
                    options: layer.options
                });
            }
        } else {
            var name = _.invert(selections)[layer];
            if (name) {
                selectionRef.child(name).update({
                    coordinates: layer.getLatLngs(),
                    options: layer.options
                });
            }
        }
    });
});

map.on('draw:deleted', function (e) {
    e.layers.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
            var markerName = _.invert(markers)[layer];
            if (markerName) {
                //console.log("removing marker " + markerName + " stamp: " + L.stamp(layer));
                markerRef.child(markerName).remove();
            }

        } else {
            var selectionName = _.invert(selections)[layer];
            //console.log(layer);
            //console.log(selections);
            if (selectionName) {
                selectionRef.child(selectionName).remove();
            }
        }
    });
});

function renderMarkers() {
    markerRef.on("child_added", function(childSnapshot, prevChildName) {
        //console.log("child added");
        createMarker(childSnapshot);
    });

    markerRef.on("child_removed", function(oldChildSnapshot) {
        //console.log('on child_removed: ');
        removeMarker(oldChildSnapshot);
    });

    markerRef.on("child_changed", function(childSnapshot, prevChildName) {
        //updateMarker(childSnapshot);
    });

    selectionRef.on("child_added", function(childSnapshot, prevChildName) {
        createSelection(childSnapshot);
    });

    selectionRef.on("child_removed", function(oldChildSnapshot) {
        //console.log('on child_removed: ');
        removeSelection(oldChildSnapshot);
    });

    selectionRef.on("child_changed", function(childSnapshot, prevChildName) {
        updateSelection(childSnapshot);
    });

}

function createSelection(snapshot) {
    var key = snapshot.key();
    var data = snapshot.val();

    if(!_.has(selections, key)) {

        var selection = null;
        //console.log(data);

        if (_.has(data, 'coordinate')) {
            selection = L.circle(data.coordinate, data.radius, data.options);

        } else if (_.has(data, 'coordinates')) {
            selection = L.polygon(data.coordinates, data.options);
        }

        //console.log("add selection " + key + " stamp=" + L.stamp(selection));
        drawnItems.addLayer(selection);
        selections[key] = selection;
    }
}

function createMarker(snapshot) {
    var key = snapshot.key();
    var data = snapshot.val();
    if(!_.has(markers, key)) {
        var marker = L.marker([data.coordinate.lat, data.coordinate.lng]);
        drawnItems.addLayer(marker);
        markers[key] = marker;
    }
}

function updateMarker(snapshot) {
    var layer = markers[snapshot.key()];
    var data = snapshot.val();

    layer.setLatLng(new L.LatLng(data.lat, data.lng));
    layer.update();
}

function removeMarker(snapshot) {
    //_.each(_.values(markers), function(m) { console.log(L.stamp(m)) });
    var key = snapshot.key();
    //console.log("received request to remove marker");
    if (_.has(markers, key)) {
        //_.each(_.values(markers), function(m) { console.log(L.stamp(m)) });
        var layer = markers[key];
        //console.log("key=" + key + " stamp=" + L.stamp(layer));
        if(drawnItems.hasLayer(layer)) {
            drawnItems.removeLayer(layer);
            delete markers[key];
        }
    }
}

function removeSelection(snapshot) {
    var key = snapshot.key();
    //console.log('remove ' + key);
    //_.each(_.values(selections), function(m) { console.log(L.stamp(m)) });
    if (_.has(selections, key)) {
        var layer = selections[key];
        //console.log('layer stamp: ' + L.stamp(layer));
        drawnItems.removeLayer(layer);
        delete selections[key];
    }
}

function updateSelection(snapshot) {
    var layer = selections[snapshot.key()];
    var data = snapshot.val();

    if(_.has(data, 'radius')) {
        layer.setRadius(data.radius);
    }

    if(_.has(data, 'coordinate')) {
        layer.setLatLng(data.coordinates);
    }

    if(_has(data, 'coordinates')) {
        layer.setLatLngs(data.coordinates);
    }

    layer.update();
}

renderMarkers();

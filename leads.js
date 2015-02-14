var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    fb = new Firebase("https://leads-poc.firebaseio.com"),
    osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    osm = L.tileLayer(osmUrl, {maxZoom: 18, attribution: osmAttrib}),
    map = new L.Map('map', {layers: [osm], center: new L.LatLng(40.7747314,-73.9653734), zoom: 15 }),
    icon1 = L.MakiMarkers.icon({
        icon: "marker",
        color: "#FFFF00",
        size: "m"
    }),
    icon2 = L.MakiMarkers.icon({
        icon: "marker",
        color: "#00CC00",
        size: "m"
    }),
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
            coordinate: layer.getLatLng(),
            assigned: false
        });

    } else if (type === "circle") {
        layer.setStyle({fillColor: "#000000"});
        selectionRef.push({
            coordinate: layer.getLatLng(),
            radius: layer.getRadius(),
            options: layer.options
        });

    } else {
        console.log("markers: " + markersInSelection(layer.getLatLngs()));
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
        updateMarker(childSnapshot);
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

function selectMarker(markerId) {
    var marker = markers[markerId];
    console.log("selecting marker " + markerId);
    markerRef.child(markerId).update({
        coordinates: marker.getLatLng(),
        assigned: true
    });
}


function createMarker(snapshot) {
    var key = snapshot.key();
    var data = snapshot.val();
    if(!_.has(markers, key)) {
        var marker = L.marker([data.coordinate.lat, data.coordinate.lng], {
            icon: (data.assigned? icon2: icon1)
        });

        drawnItems.addLayer(marker);
        markers[key] = marker;
    }
}

function updateMarker(snapshot) {
    var markerId = snapshot.key();
    var layer = markers[markerId];
    var data = snapshot.val();
    //console.log("maker updated: " + markerId);
    layer.setLatLng(new L.LatLng(data.coordinate.lat, data.coordinate.lng));
    layer.setIcon((data.assigned? icon2: icon1));
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

function markersInSelection(polygon) {
    var count  = 0;
    _.each(_.keys(markers), function(markerId) {
        var marker = markers[markerId];
        if (pointIsInPoly(marker.getLatLng(), polygon)) {
            selectMarker(markerId);
            count++;
        }
    });
    return count;
}

function pointIsInPoly(p, polygon) {
    var isInside = false;
    var minX = polygon[0].lng, maxX = polygon[0].lng;
    var minY = polygon[0].lat, maxY = polygon[0].lat;
    for (var n = 1; n < polygon.length; n++) {
        var q = polygon[n];
        minX = Math.min(q.lng, minX);
        maxX = Math.max(q.lng, maxX);
        minY = Math.min(q.lat, minY);
        maxY = Math.max(q.lat, maxY);
    }

    if (p.lng < minX || p.lng > maxX || p.lat < minY || p.lat > maxY) {
        return false;
    }

    var i = 0, j = polygon.length - 1;
    for (i, j; i < polygon.length; j = i++) {
        if ( (polygon[i].lat > p.lat) != (polygon[j].lat > p.lat) &&
            p.lng < (polygon[j].lng - polygon[i].lng) * (p.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng ) {
            isInside = !isInside;
        }
    }

    return isInside;
}

renderMarkers();

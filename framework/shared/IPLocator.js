var IPLocator = (function () {
    var debug = false;

    function degreesToRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function distanceInKmBetweenEarthCoordinates(lat1, lon1, lat2, lon2) {
        //ideas taken from http://www.movable-type.co.uk/scripts/latlong.html
        var earthRadiusKm = 6371;

        var dLat = degreesToRadians(lat2 - lat1);
        var dLon = degreesToRadians(lon2 - lon1);

        lat1 = degreesToRadians(lat1);
        lat2 = degreesToRadians(lat2);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    /**
     *
     * @callback updateCallback
     * @param {Object} response
     * @param {number} response.lat
     * @param {number} response.lon
     */

    /**
     * Currently only works with with https://freegeoip.net/json/.
     * @param options
     * @param {String} [options.locations=https://freegeoip.net/json/] - Access point.
     * @param {number} [options.distance=300] - Distance to close nodes in km.
     * @param updateCallback {updateCallback}
     * @constructor
     */
    function IPLocator(options, updateCallback) {
        if(!options)options={};
        if (!options.locations) options.locations = "https://freegeoip.net/json/";
        if (!options.distance) options.distance = 300;
        this.locations = options.locations;
        this.distance = options.distance;
        this.updateCallback = updateCallback;

        this.response = null;
        this.latlong = null;
    }

    /**
     * Distance between coordinates.
     * @param {Object} a.
     * @param {Object} b.
     * @param {string} a.lat - latitude.
     * @param {string} b.lat - latitude.
     * @param {string} a.lon - longitude.
     * @param {string} b.lon - longitude.
     */
    IPLocator.prototype.distanceFunction = function (a, b) {
        return distanceInKmBetweenEarthCoordinates(a.lat, a.lon, b.lat, b.lon);
    };

    IPLocator.prototype.gotAnswer = function (data) {
        this.response = JSON.parse(data);
        this.latlong = {lat: this.response.latitude, lon: this.response.longitude};
        console.log("New location: " + JSON.stringify(this.latlong));
        this.updateCallback(this.latlong);
    };

    IPLocator.prototype.start = function () {
        var gip = this;
        this.makeGeoIPCorsRequest(this.location, function (response) {
            if (response) {
                gip.gotAnswer(response);
            } else {
                gip.gotAnswer("{latitude:0,longitude:0}");
            }
        })
    };

    IPLocator.prototype.makeGeoIPCorsRequest = function (url, callback) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", "https://freegeoip.net/json/");

            xhr.onloadstart = function () {
                if (debug) console.info("Sending xhr GET to " + url);
            };

            xhr.onload = function () {
                if (debug) console.info(xhr.response);
                callback(xhr.response);
            };

            xhr.onerror = xhr.onabort = function (e) {
                if (debug) console.error("IPLocator failed.", e);
                callback(null);
            };

            xhr.onreadystatechange = function (a) {
                if (debug) console.log("IPLocator ready state changed", a);
            };

            xhr.send();

            if (debug) console.log(xhr);

        } catch (e) {
            if (debug) console.error("IPLocator failed.", e);
            callback(null);
        }
    };
    return IPLocator;
})();

if (typeof exports != "undefined") {
    exports.IPLocator = IPLocator;
}
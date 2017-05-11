/**
 * ""Synchronous XMLHttpRequest on the main thread is deprecated
 * because of its detrimental effects to the end user's experience.""
 *      Don't you tell me what to do, Chrome. Thanks, Albert.
 */

var pingDebug = false;
function HTTPPinger(options, updateCallback) {
    this.times = 3;
    this.locations = options.locations;
    this.updateCallback = updateCallback;

    this.first = true;

    this.pings = [];
    for (var i = 0; i < this.locations.length; i++) {
        this.pings[i] = [];
    }
}
HTTPPinger.INTERVAL = 50;

HTTPPinger.prototype.distanceFunction = function (arr1, arr2) {
    var intervalCount = 0;
    for (var i = 0; i < arr1.length && i < arr2.length; i++) {

        if (Math.abs(arr1[i] - arr2[i]) > HTTPPinger.INTERVAL) {
            intervalCount++;
        }
    }
    return intervalCount;
};

HTTPPinger.prototype.newData = function () {
    var ret = [];
    for (var j = 0; j < this.pings.length; j++) {
        var sum = 0;
        for (var i = 0; i < this.times; i++) {
            sum += this.pings[j][i];
        }
        ret.push(Math.ceil(sum / this.times));
    }
    this.first = false;
    console.log("HTTPPinger: " + JSON.stringify(ret));
    this.updateCallback(ret);
};

HTTPPinger.prototype.start = function () {
    var htppp = this;
    var times = this.times * this.pings.length;
    for (var i = 0; i < this.times; i++) {
        for (var j = 0; j < this.pings.length; j++) {
            (function (a) {
                setTimeout(function () {
                    htppp.anotherPing(a, function () {
                        times--;
                        if (times == 0) {
                            htppp.newData();
                        }
                    });
                }, Math.ceil((i + j) * 2 * Math.random()));
            })(j);
        }
    }
};

HTTPPinger.prototype.anotherPing = function (locationID, cb) {
    var htppp = this;
    this.makeCorsRequest(this.locations[locationID], function (rtt) {
        if (htppp.pings[locationID].length > htppp.times) {
            htppp.pings[locationID] = htppp.pings[locationID].slice(1).concat(rtt);
        } else
            htppp.pings[locationID] = htppp.pings[locationID].concat(rtt);
        cb();
    })
};

HTTPPinger.prototype.makeCorsRequest = function (url, callback) {
    var a, b;
    try {
        if (pingDebug) console.warn(this.first);
        var xhr = new XMLHttpRequest();
        xhr.open("HEAD", url + "?rand=" + (new Date()).getTime(), !this.first);

        if (!this.first) {
            xhr.onloadstart = function () {
                if (pingDebug) console.info("1");
                a = new Date();
            };
            xhr.onload = function () {
                if (pingDebug) console.info("2");
                b = new Date();
                callback(b.getTime() - a.getTime());
            };
            xhr.onerror = xhr.onabort = xhr.onload;

            xhr.onreadystatechange = function (a) {
                if (pingDebug) console.info("B");
                if (pingDebug) console.info(a)
            };
        } else {
            if (pingDebug) console.info("1");
            a = new Date();
        }
        xhr.setRequestHeader("Cache-Control", "no-cache");
        xhr.send();
        if (pingDebug) console.log(xhr);
        if (this.first) {
            if (pingDebug) console.info("2");
            b = new Date();
            callback(b.getTime() - a.getTime());
        }
    } catch (e) {
        if (pingDebug) console.info(e);
        if (this.first) {
            if (pingDebug) console.info("2");
            b = new Date();
            callback(b.getTime() - a.getTime());
        }
    }
};

if (typeof exports != "undefined") {
    exports.HTTPPinger = HTTPPinger;
}
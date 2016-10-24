if (typeof exports != "undefined") {
    exports.VersionVector = VersionVector;
}

/**
 *
 * @constructor
 */
function VersionVector() {
    this.map = {};
}

/**
 *
 * @param replica {String}
 * @param version {Number}
 */
VersionVector.prototype.set = function (replica, version) {
    this.map[replica] = version;
};

/**
 *
 * @param replica {String}
 * @returns {Number}
 */
VersionVector.prototype.get = function (replica) {
    return this.map[replica];
};

/**
 *
 * @param replica {String}
 * @returns {boolean}
 */
VersionVector.prototype.contains = function (replica) {
    return this.map[replica] != null;
};
/**
 *
 * @returns {Array.<String>}
 */
VersionVector.prototype.getKeys = function () {
    return Object.keys(this.map);
};

/**
 *
 * @returns {{}}
 */
VersionVector.prototype.toJSONString = function () {
    var keys = Object.keys(this.map);
    var vv = {};
    for (var i = 0; i < keys.length; i++) {
        vv[keys[i]] = this.map[keys[i]];
    }
    return vv;
};

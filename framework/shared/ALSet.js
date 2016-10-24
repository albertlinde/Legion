//TODO: check where this is used and REMOVE.
if (typeof exports != "undefined")
    exports.ALSet = ALSet;

function ALSet() {
    this.set = {};
}

ALSet.prototype.add = function (element) {
    this.set[element] = true;
};

ALSet.prototype.delete = function (element) {
    delete this.set[element];
};

ALSet.prototype.contains = function (element) {
    return this.set[element] === true;
};

ALSet.prototype.size = function () {
    return Object.keys(this.set).length;
};

ALSet.prototype.asArray = function () {
    return Object.keys(this.set);
};

ALSet.prototype.toJSONString = function () {
    return this.asArray();
};

ALSet.prototype.fromJSONString = function (string) {
    this.set = {};
    if (string) {
        for (var i = 0; i < string.length; i++) {
            this.set[string[i]] = true;
        }
    }
};
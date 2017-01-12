//TODO: this should be optional/parameterizable. when using security this actually might be bad.
if (typeof exports != "undefined") {
    exports.compress = compress;
    exports.decompress = decompress;
    LZMA = require("./../../node_modules/lzma");
}

var fromDecToHex = function (number) {
    if (number < 0) {
        number = 0xFFFFFFFF + number + 1;
        return number.toString(16).substring(6, 8);
    }
    var ret = number.toString(16);
    if (ret.length == 1)
        ret = "0" + ret;

    return ret;
};
var fromHexToDec = function (hex) {
    return parseInt(hex, 16);
};

function compress(data, callback) {
    if (typeof(LZMA) != "undefined") {
        LZMA.compress(data, 1, function (result) {
            var ret = "";
            for (var i = 0; i < result.length; i++) {
                ret += fromDecToHex(result[i]);
            }
            callback(ret)
        }, function () {
        });
    } else {
        callback(data);
    }
};

function decompress(data, callback) {
    var to_deco = [];
    for (var j = 0; j < data.length; j += 2) {
        to_deco.push(fromHexToDec(data[j] + data[j + 1]));
    }
    if (typeof(LZMA) != "undefined") {
        LZMA.decompress(to_deco, function (result) {
            callback(result)
        }, function () {
        });
    } else {
        callback(data);
    }
};
var UglifyJS = require('uglify-js');
var walk = require('walk');
var fs = require('fs')

var files = [];
var walker = walk.walk('./extensions/', {followLinks: false});

var handler = function (root, stat, next) {
    if (stat.name.substr(stat.name.length - 3) == ".js") {
        console.error("Adding file: " + stat.name);
        files.push(root + '/' + stat.name);
    } else {
        console.error("Not adding file: " + stat.name);
    }
    next();
};

var end = function () {
    console.error("Ending.")

    for (var i = 0; i < files.length; i++) {
        console.error(files[i]);
        fs.readFile(files[i], 'utf8', function (err, data) {
            if (err) {
                return console.error(err);
            }
            console.log(data);
        });

    }
    console.error("Ended.")

};


walker.on('file', handler);

walker.on('end', end);

var config = {};
var util = require('util');
var express = require('express');
var path = require('path');

config.signalling = {
    PORT_HTTP: 80,
    PORT_HTTPS: 443,
    SERVER_HB_INTERVAL: 45 * 1000,
    SERVER_HB_VALIDITY: 300 * 1000,
    SENDER_ID: "SS",
    key: "./keys/key.pem",
    cert: "./keys/cert.pem",
    public_key: "./keys/public_key.pem"
};

config.objectsServer = {
    PORT: 8000,
    key: "./keys/key.pem",
    cert: "./keys/cert.pem",
    OBJECT_SERVER_ID: "OS",
    CLEAR_QUEUE_INTERVAL: 3 * 1000,
    SAVE_INTERVAL: 20 * 1000
};

config.statics =
    [
        ["/node_modules", express.static(path.resolve('./../../node_modules'))],
        ["/pacman", express.static(path.resolve('./../../applications/pacman-mp'))],
        ["/shooter", express.static(path.resolve('./../../applications/legion-shooter'))],
        ["/", express.static(path.resolve('./../../applications/legion-shooter'))],
        ["/applications", express.static(path.resolve('./../../applications/'))],
        ["/applications/examples", express.static(path.resolve('./../../applications/examples'))],
        ["/chat", express.static(path.resolve('./../../applications/examples/chat.html'))],
        ["/chat/", express.static(path.resolve('./../../applications/examples/chat.html'))],
        ["/img", express.static(path.resolve('./../../applications/examples/img'))]
    ];

config.routes = [
    ["/", './../../applications/examples/index.html', function () {
        util.log("Got index.html");
    }],
    ["/shooter", './../../applications/legion-shooter/game.html', function () {
        util.log("Redirect to game.");
    }],
    ["/shooter/", './../../applications/legion-shooter/game.html', function () {
        util.log("Redirect to game.");
    }]
];

/**
 *
 * @param client {{id: {string}, secret: {string}}}
 * @returns {Object}
 */
config.clientCheck = function (client) {
    //util.log("V1: " + JSON.stringify(client));
    //TODO: programmer-defined.
    return {success: true, message: "Done."};
};

/**
 *
 * @param client {{id: {string}, secret: {string}}}
 * @param group {{id: {string}, secret: {string}}}
 * @returns {Object}
 */
config.groupCheck = function (client, group) {
    //TODO: programmer-defined.
    return {success: true, message: "Done."};
};

module.exports = config;
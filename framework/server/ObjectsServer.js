var httpServ = require('https');
var fs = require('fs');

var processRequest = function (req, res) {
    res.writeHead(200);
    res.end('WebSocket!\n');
};

var Config = require('./config.js');

var cfg = {
    port: Config.objectsServer.PORT,
    ssl_key: Config.objectsServer.key,
    ssl_cert: Config.objectsServer.cert
};

var app = httpServ.createServer({
    key: fs.readFileSync(cfg.ssl_key),
    cert: fs.readFileSync(cfg.ssl_cert)

}, processRequest).listen(cfg.port);

var PeerSync = require('./../shared/peerSync.js').PeerSync;
var CRDT_Database = require('./CRDT_Database.js').CRDT_Database;
var ServerMessaging = require('./ServerMessaging.js').ServerMessaging;

var Compressor = require('./../shared/Compressor.js');
var Duplicates = require('./../shared/Duplicates.js').Duplicates;
var ALMap = require('./../shared/ALMap.js').ALMap;

var NodesStructure = require('./NodesStructure.js').NodesStructure;

var util = require('util');
var WebSocket = require('ws');

var WebSocketServer;
var wss;

function OSGroup(id) {

    this.peerSyncs = new ALMap();
    this.messagingAPI = new ServerMessaging(this.peerSyncs);
    this.db = new CRDT_Database(this.messagingAPI, this.peerSyncs, this);

    this.id = id;
    this.nodes = new NodesStructure();
    this.active = false;

}

OSGroup.prototype.removeClient = function (id) {
    this.nodes.removeNode(id);
    this.peerSyncs.delete(id);
};

OSGroup.prototype.addClient = function (socket) {
    this.nodes.addNode(socket.remoteID, socket);
    var ps = new PeerSync(this.db, this.db, socket);
    this.peerSyncs.set(socket.remoteID, ps);
};

function initialIntegrityCheck(parsed, socket) {
    if (socket.remoteID) {
        return (
            parsed.type &&
            parsed.group && parsed.group.id &&
            parsed.s &&
            parsed.ID
        );
    } else {
        return (
            parsed.type == "CLIENT_ID" &&
            parsed.client && parsed.client.id && parsed.client.secret &&
            parsed.s &&
            parsed.group && parsed.group.id && parsed.group.secret
        );
    }
}

var killClientConnection = function (socket, err, thrown_event, original_message) {
    //TODO: check error, log, remove the client, block the client.
    util.log("Killing a client.");
    util.log(err);
    socket.close();
};

initService();
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        server: app,
        verifyClient: function (info, cb) {
            cb(true);
        }
    });

    var defaultGroup = {
        id: "default",
        secret: "default",
        crdts: {
            permitted: function (id, type) {
                return false; //no more objects for the example/index page.
            },
            lists: ["list_1", "list_2", "list_3"],
            maps: ["map_1", "map_2", "map_3"],
            sets: ["set_1", "set_2", "set_3"],
            counters: ["counter_1", "counter_2", "counter_3"]
        }
    };
    var groups = new ALMap();

    groups.set(defaultGroup.id, new OSGroup(defaultGroup.id, defaultGroup));

    { // Client connection handling.
        var duplicates = new Duplicates();
        wss.on('connection', function (socket) {
                //TODO: how does security work here?
                //TODO: hardcoded ids.
                var os = {
                    id: "localhost:8004",
                    messageCount: 0
                };
                var g;

                util.log("Connection.");

                socket.on('message', function incoming(original) {
                    var parsed;
                    try {
                        parsed = JSON.parse(original);
                    } catch (error) {
                        killClientConnection(socket, "JSON parse failed.", error, original);
                        return;
                    }

                    if (!initialIntegrityCheck(parsed, socket)) {
                        killClientConnection(socket, "Failed on initial integrity check.", null, original);
                        return;
                    }

                    if (duplicates.contains(parsed.s, parsed.ID)) {
                        util.log(" : d " + parsed.type + ".");
                        return;
                    }

                    duplicates.add(parsed.s, parsed.ID);
                    util.log(" : " + parsed.type + " from " + parsed.s + " : " + JSON.stringify(socket.client));

                    if (parsed.type == "CLIENT_ID") {
                        console.log("New client: " + parsed.client.id + " with node: " + parsed.nodeID);
                        socket.remoteID = parsed.nodeID;
                        socket.client = parsed.client;
                        socket.group = parsed.group;

                        g = groups.get(parsed.group.id);
                        if (g) {
                            g.addClient(socket);
                        } else {
                            util.log("ERROR: group does not exist.");
                            util.log("    creating group: " + parsed.group.id);
                            groups.set(parsed.group.id, new OSGroup(parsed.group.id, parsed.group));
                            g = groups.get(parsed.group.id);
                            g.addClient(socket);
                        }
                    } else {
                        if (!socket.group) {
                            util.log("ERROR: client has no group.")
                        } else {
                            g = groups.get(socket.group.id);
                            var db = g.db;
                            if (parsed.type == db.handlers.peerSync.type) {
                                db.handlers.peerSync.callback(parsed, socket);
                            } else if (parsed.type == db.handlers.peerSyncAnswer.type) {
                                db.handlers.peerSyncAnswer.callback(parsed, socket);
                            } else if (parsed.type == db.handlers.gotContentFromNetwork.type) {
                                db.handlers.gotContentFromNetwork.callback(parsed, socket);
                            } else {
                                util.error("Unkown message type.");
                                util.log(JSON.stringify(parsed));
                            }
                        }
                    }
                });
                socket.on('close', function () {
                    if (socket.remoteID) {
                        util.log("Disconnected " + socket.remoteID);
                        g.removeClient(socket.remoteID);
                    } else
                        util.log("Disconnected.");
                });
            }
        )
    }
}

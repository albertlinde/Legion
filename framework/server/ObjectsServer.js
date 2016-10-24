//TODO: make constants be somewhere nice (from CRDT_Database also)
var PORT = 8004;

var PeerSync = require('./../shared/peerSync.js').PeerSync;
var CRDT_Database = require('./CRDT_Database.js').CRDT_Database;
var ServerMessaging = require('./ServerMessaging.js').ServerMessaging;

var Compressor = require('./../shared/Compressor.js');
var D = require('./../shared/Duplicates.js');
var ALMap = require('./../shared/ALMap.js').ALMap;

var CRDT = require('./../shared/crdt.js').CRDT;


var CRDT_LIB = {};

CRDT_LIB.Counter = require('./../shared/crdtLib/deltaCounter.js').DELTA_Counter;
CRDT_LIB.Set = require('./../shared/crdtLib/deltaSet.js').DELTA_Set;
CRDT_LIB.Map = require('./../shared/crdtLib/deltaMap.js').DELTA_Map;
CRDT_LIB.List = require('./../shared/crdtLib/deltaList.js').DELTA_List;

var util = require('util');
var WebSocket = require('ws');
//TODO: use storage... (not here)
var storage = require('node-persist');

var WebSocketServer;
var wss;

initService();
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        port: PORT, verifyClient: function (info, cb) {
            cb(true);
        }
    });

    var peerSyncs = new ALMap();
    var messagingAPI = new ServerMessaging(peerSyncs);

    /**
     * CRDT Database - contains all known crdts.
     * @type {CRDT_Database}
     */
    var db = new CRDT_Database(messagingAPI, peerSyncs);

    db.defineCRDT(CRDT_LIB.Counter);
    db.defineCRDT(CRDT_LIB.Set);
    db.defineCRDT(CRDT_LIB.Map);
    db.defineCRDT(CRDT_LIB.List);

    { // Client connection handling.
        var duplicates = new D.Duplicates();
        var nodes = [];

        wss.on('connection', function (socket) {
                //TODO: how does security work here?
                //TODO: hardcoded ids.
                var os = {
                    id: "localhost:8004",
                    messageCount: 0
                };

                util.log("Connection.");
                nodes.push(socket);
                db.id = os.id;

                /**
                 * For generating messages that can be sent.
                 * Type is required.
                 * Data (optional) is compressed to save bandwidth.
                 * @param type {String}
                 * @param data {Object}
                 * @param callback {Function}
                 */
                    //TODO: why is this?
                db.versionVectorDiff = CRDT.versionVectorDiff;

                //TODO: will be ClientSync
                var ps = new PeerSync(db, db, socket);
                db.handlers = {
                    peerSync: {
                        //The order is, when clients syncs objects are initiated on the server side.
                        //Only then can the server sync as this is when he HAS them.
                        //Only on PSA will the objects have the client's changes.
                        type: "OS:PS", callback: function (message, original, connection) {
                            //util.log("AA1" + JSON.stringify(message));
                            var objects = message.data;
                            for (var i = 0; i < objects.length; i++) {
                                db.getOrCreate(objects[i].id, objects[i].type);
                            }
                            var ps = peerSyncs.get(connection.remoteID);
                            ps.sync();
                            ps.handleSync(message);
                        }
                    },
                    peerSyncAnswer: {
                        type: "OS:PSA", callback: function (message, original, connection) {
                            //util.log("AA2" + JSON.stringify(message));
                            var ps = peerSyncs.get(connection.remoteID);
                            ps.handleSyncAnswer(message, original, connection);
                        }
                    },
                    gotContentFromNetwork: {
                        type: "OS:C", callback: function (message, original, connection) {
                            //util.log("AA3" + JSON.stringify(message));
                            db.gotContentFromNetwork(message, original, connection);
                        }
                    }
                };

                socket.on('message', function incoming(message) {
                    var parsed = JSON.parse(message);
                    console.log("Got " + parsed.type + " from " + socket.remoteID + " s: " + parsed.sender);


                    if (!duplicates.contains(parsed.sender, parsed.ID)) {
                        duplicates.add(parsed.sender, parsed.ID);
                        var original = JSON.parse(message);

                        var cb = function (parsed) {
                            if (parsed.type == "CLIENT_ID") {
                                console.log("New client: " + parsed.clientID);
                                socket.remoteID = parsed.clientID;
                                peerSyncs.set(socket.remoteID, ps);
                                return;
                            }

                            if (parsed.type == db.handlers.peerSync.type) {
                                db.handlers.peerSync.callback(parsed, original, socket);
                            } else if (parsed.type == db.handlers.peerSyncAnswer.type) {
                                db.handlers.peerSyncAnswer.callback(parsed, original, socket);
                            } else if (parsed.type == db.handlers.gotContentFromNetwork.type) {
                                db.handlers.gotContentFromNetwork.callback(parsed, original, socket);
                            } else {
                                util.error("Unkown message type.");
                                util.log(JSON.stringify(parsed));
                            }
                        };

                        if (parsed.compressed) {
                            Compressor.decompress(parsed.compressed, function (result) {
                                parsed.data = JSON.parse(result);
                                cb(parsed);
                            });
                        } else {
                            Compressor.decompress("5d00000100040000000000000000331849b7e4c02e1ffffac8a000", function (result) {
                                cb(parsed);
                            });
                        }
                    } else {
                        util.log("Duplicate.")
                    }
                });
                socket.on('disconnect', function () {
                    util.log("Disconnected.");
                });
            }
        )
    }
}

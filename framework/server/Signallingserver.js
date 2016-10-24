var Config = require('./config.js');
var Duplicates = require('./../shared/Duplicates.js').Duplicates;
var Compressor = require('./../shared/Compressor.js');
var distanceFunction = require('./../shared/Utils.js').distanceFunction;

var util = require('util');
var WebSocket = require('ws');

var ALMap = require('./../shared/ALMap.js').ALMap;
var AuthServer = require('./Authserver.js').AuthServer;

initService();

var WebSocketServer;
var wss;
function initService() {
    WebSocketServer = WebSocket.Server;
    wss = new WebSocketServer({
        port: Config.signalling.PORT, verifyClient: function (info, cb) {
            cb(true);
        }
    });

    var duplicates = new Duplicates();

    var messageCount = 0;

    //TODO: on server re-boot message generation breaks.
    /**
     *
     * @param type {string}
     * @returns {{type: string, sender: string, ID: number}}
     */
    var generateMessage = function (type) {
        return {
            type: type,
            sender: Config.signalling.SENDER_ID,
            ID: ++messageCount
        };
    };

    var nodes = new NodesStructure();
    var authority = new AuthServer();

    //TODO: well defined security and parameters
    setInterval(function () {
        var HB = generateMessage("SHB");
        HB.timestamp = Date.now();
        HB.validity = Config.signalling.SERVER_HB_VALIDITY;
        HB.KeyID = authority.getCurrentKey().id;
        HB.signature = authority.signedMessageDigest("" + HB.timestamp + HB.ID + HB.KeyID + HB.validity);
        var msg = JSON.stringify(HB);

        util.log("HB time: [" + HB.timestamp + "," + (HB.timestamp + HB.validity) + "]");
        var deadNodes = [];
        for (var i = 0; i < nodes.size(); i++) {
            var node = nodes.getNodeByPos(i);
            if (node.readyState == 1) {
                console.log("  -> Sending HB to " + node.remoteID);
                node.send(msg);
            } else {
                deadNodes.push(node.remoteID);
            }
        }
        nodes.removeAllNodes(deadNodes);

    }, Config.signalling.SERVER_HB_INTERVAL);

    wss.on('connection', function (socket) {
            //TODO: am working here, node IDs and distances must be confirmed if they are sent and kept correctly.
            util.log("Connection.");
            socket.on('message', function incoming(message) {
                    //util.log(message);
                    //TODO: try catch on parse.
                    var parsed = JSON.parse(message);
                    //console.log(parsed);
                    if (parsed.type == "Auth") {
                        if (!socket.remoteID) {
                            if (nodes.contains(parsed.client_id)) {
                                util.log("Reconnected with new socket " + parsed.client_id);
                            } else {
                                util.log("Connected " + parsed.client_id);
                            }
                            socket.remoteID = parsed.client_id;
                            nodes.addNode(parsed.client_id, socket);
                        }

                        //TODO: again, define security.
                        var auth = authority.verify(parsed);
                        util.log("Got Auth from " + parsed.client_id);
                        console.log("   -> Sending back auth response: " + JSON.stringify(auth.auth.result));
                        socket.send(JSON.stringify(auth));
                        if (auth.auth.result == "Failed") {
                            socket.close();
                        }
                    }
                    else if (parsed.type == "ConnectRequest") {
                        Compressor.decompress(parsed.compressed, function (result) {
                            /**
                             * @type{
                             * {distances: Array.<Number>,
                             * close: 1|0,
                             * far: 1|0,
                             * hop: 1}
                             * }
                             */
                            var data = JSON.parse(result);
                            socket.distances = data.distances;

                            var deadNodes = [];
                            var end = nodes.size() - 1;
                            var start = Math.floor(end * Math.random());

                            var doneClose = data.close < 1;
                            var doneFar = data.far < 1;
                            nodes.getNodeByPos(0);//resets keys.

                            var sent = false;
                            util.log("Got ConnectRequest to (" + data.close + "," + data.far + ")from " + socket.remoteID);

                            for (var i = start; end > 0;) {
                                var node = nodes.getNodeByPos(i);
                                console.log("  -> Checking  node " + node.remoteID + " from " + i + " [" + start + "," + end + "]");

                                if (node === socket) {
                                    //don't send back.
                                } else {
                                    if (node.readyState == 1) {
                                        if (node.distances) {
                                            var actualDistance = distanceFunction(node.distances, data.distances);
                                            console.log("    -> distance:" + actualDistance, node.distances, data.distances);

                                            if (actualDistance <= 1 && !doneClose) {
                                                console.log("      -> Sending to close node " + node.remoteID);
                                                node.send(message);
                                                sent = true;
                                                doneClose = true;
                                            }

                                            if (actualDistance > 1 && !doneFar) {
                                                console.log("      -> Sending to far node " + node.remoteID);
                                                node.send(message);
                                                sent = true;
                                                doneFar = true;
                                            }
                                        }
                                    } else {
                                        deadNodes.push(node.remoteID);
                                    }
                                }
                                if (doneClose && doneFar) break;
                                i++;
                                if (i > end) {
                                    i = 0;
                                    end = nodes.size() - 1;
                                }
                                if (i == start) {
                                    break;
                                }
                            }
                            if (!sent) {
                                console.log("  -> No suitable nodes found.");
                            }
                            if (deadNodes.length > 0) {
                                util.log("Removed nodes: " + deadNodes);
                                nodes.removeAllNodes(deadNodes);
                            }
                        });
                    }
                    else if (parsed.type == "LocalRandomWalk") {
                        console.log("ERROR!!!");
                        console.log(message);
                        console.log("ERROR!!!");
                    }
                    else if (parsed.type == "FarRandomWalk") {
                        console.log("ERROR!!!");
                        console.log(message);
                        console.log("ERROR!!!");
                    }
                    else if (parsed.type == "DistancesUpdate") {
                        Compressor.decompress(parsed.compressed, function (result) {
                            console.log(result);
                            socket.distances = result.distances;
                            console.log("Updated distances for peer " + socket.remoteID)
                        });
                    } else {
                        if (!duplicates.contains(parsed.sender, parsed.ID)) {
                            duplicates.add(parsed.sender, parsed.ID);

                            if (parsed.destination != null) {
                                //Try to send do destination, on failure back to default behaviour.
                                var node = nodes.getNode(parsed.destination);
                                if (node && node.readyState == 1) {
                                    util.log("Destination message: " + parsed.type);
                                    console.log("   -> Sending to " + parsed.destination);
                                    node.send(message);
                                    return;
                                }
                            }
                            util.log("Broadcast: " + parsed.type);
                            var end = nodes.size();
                            if (parsed.N) {
                                end = Math.min(parsed.N, end);
                            }
                            if (parsed.ttl) {
                                parsed.ttl--;
                            }
                            var message = JSON.stringify(parsed);
                            var deadNodes = [];
                            for (var i = 0; i < end; i++) {
                                //TODO: if sending to N, randomize the nodes it is sent to.
                                var node = nodes.getNodeByPos(i);
                                if (node === socket)continue;
                                if (node.remoteID == parsed.sender)continue;

                                if (node.readyState == 1) {
                                    console.log("   -> Sending to " + node.remoteID);
                                    node.send(message);
                                } else {
                                    deadNodes.push(node.remoteID);
                                }
                            }
                            nodes.removeAllNodes(deadNodes);
                        }
                    }
                }
            );
            socket.on('close', function () {
                util.log("Disconnected " + socket.remoteID);
                nodes.removeNode(socket.remoteID);
            });
        }
    )
}

function NodesStructure() {
    this.nodesMap = {};
    this.count = 0;
    this.keys = [];
}

NodesStructure.prototype.size = function () {
    return this.count;
};

NodesStructure.prototype.contains = function (id) {
    return this.nodesMap[id] != null;
};

NodesStructure.prototype.getNode = function (id) {
    return this.nodesMap[id];
};
NodesStructure.prototype.getNodeByPos = function (pos) {
    if (pos == 0) {
        this.keys = Object.keys(this.nodesMap);
    }
    return this.nodesMap[this.keys[pos]];
};

NodesStructure.prototype.addNode = function (id, socket) {
    if (!this.contains(id))
        this.count++;
    this.nodesMap[id] = socket;
};

NodesStructure.prototype.removeAllNodes = function (idArray) {
    for (var i = 0; i < idArray.length; i++) {
        this.removeNode(idArray[i]);
    }
};

NodesStructure.prototype.removeNode = function (id) {
    if (this.contains(id))
        this.count--;
    delete this.nodesMap[id];
};
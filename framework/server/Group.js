var ALMap = require('./../shared/ALMap.js').ALMap;
var forge = require('node-forge');
var util = require('util');
var Config = require('./config.js');
var loc1 = require('./../shared/IPLocator.js');
var IPLocator = new loc1.IPLocator();
var loc2 = require('./../shared/HTTPPinger.js');
var HTTPPinger = new loc2.HTTPPinger({locations:[]});

var NodesStructure = require('./NodesStructure.js').NodesStructure;

exports.Group = Group;

function Group(options, lastHB) {
    if (options)
        this.options = options;
    else
        this.options = {};
    this.id = options.id;
    //TODO: keep clients
    util.log("New Group: " + options.id);

    this.nodes = new NodesStructure();
    this.lastHB = lastHB;
}

Group.prototype.verifyClient = function (clientDetails, groupDetails) {
    util.log("Verify client in Group.");
};

Group.prototype.removeClient = function (socket) {
    this.nodes.removeNode(socket.client.id);
};

Group.prototype.clientInGroup = function (groupDetails, socket) {
    util.log("client in Group.");
    return this.nodes.contains(socket.client.id)
};

Group.prototype.canJoin = function (groupDetails, socket) {
    util.log("canJoin in Group.");
    return true;
};

Group.prototype.addToNodes = function (socket) {
    var m = {
        type: "JoinGroupAnswer",
        success: true
    };
    socket.groups.set(this.id, this);
    socket.send(JSON.stringify(m));
    this.nodes.addNode(socket.client.id, socket);
    if (this.lastHB && this.nodes.size() == 1) {
        socket.send(this.lastHB);
    }
};

Group.prototype.handleMessage = function (socket, message, original) {
    util.log("Handle Message in " + this.id + " : " + message.type);
    if (message.type == "JoinGroup" || message.type == "CreateGroup") {
        if (this.canJoin(message.group, socket.client)) {
            util.log("   " + socket.client.id + " joined " + this.id);
            this.addToNodes(socket);
        } else {
            util.log("TODO: Send back reject.");
            //TODO. send back reject.
        }
    } else {
        if (this.clientInGroup(message.group, socket)) {
            this.handle(socket, message, original);
        } else {
            if (this.canJoin(message.group, socket.client)) {
                this.addToNodes(socket);
                this.handle(socket, message, original);
            } else {
                util.log("TODO: Send back not joined.");
                //TODO: send back not joined.}
            }
        }
    }
};

Group.prototype.sendHB = function (HB) {
    this.lastHB = HB;
    if (this.nodes.size() > 0) {
        util.log("Group active: " + this.id);
        var deadNodes = [];
        for (var i = 0; i < this.nodes.size(); i++) {
            var node = this.nodes.getNodeByPos(i);
            if (node.readyState == 1) {
                util.log("  -> Sending HB to " + node.client.id);
                node.send(HB);
            } else {
                deadNodes.push(node.client.id);
            }
        }
        this.nodes.removeAllNodes(deadNodes);
    } else {
        util.log("Group not active: " + this.id);
    }
};

Group.prototype.broadcast = function (message, nodes, socket) {
    util.log("Broadcast: " + message.type);
    var end = nodes.size();
    if (message.N) {
        end = Math.min(message.N, end);
    }
    if (message.ttl) {
        message.ttl--;
    }
    var message_as_string = JSON.stringify(message);
    var deadNodes = [];
    for (var i = 0; i < end; i++) {
        //TODO: if sending to N, randomize the nodes it is sent to.
        var node = nodes.getNodeByPos(i);
        if (node === socket)continue;
        if (node.client.id == message.s)continue;

        if (node.readyState == 1) {
            util.log("   -> Sending to " + node.client.id);
            node.send(message_as_string);
        } else {
            deadNodes.push(node.client.id);
        }
    }
    nodes.removeAllNodes(deadNodes);
};

Group.prototype.handle = function (socket, message, original) {
    var nodes = this.nodes;
    if (message.type == "CR") {
        /**
         * @type{
                             * {distances: Array.<Number>,
                             * close: 1|0,
                             * far: 1|0,
                             * hop: 1}
                             * }
         */
        var data = message.data;
        socket.distances = data.distances;

        var deadNodes = [];
        var end = nodes.size() - 1;
        var start = Math.floor(end * Math.random());

        var doneClose = data.close < 1;
        var doneFar = data.far < 1;
        nodes.getNodeByPos(0);//resets keys.

        var sent = false;
        util.log("Got ConnectRequest to (" + data.close + "," + data.far + ")from " + socket.client.id);

        for (var i = start; end > 0;) {
            var node = nodes.getNodeByPos(i);
            util.log("  -> Checking  node " + node.client.id + " from " + i + " [" + start + "," + end + "]");

            if (node === socket) {
                //don't send back.
            } else {
                if (node.readyState == 1) {
                    if (node.distances) {
                        if (node.distances instanceof Array && data.distances instanceof Array) {
                            var actualDistance = HTTPPinger.distanceFunction(node.distances, data.distances);
                            util.log("    -> distance:" + actualDistance, node.distances, data.distances);

                            if (actualDistance <= 1 && !doneClose) {
                                util.log("      -> Sending to close node " + node.client.id);
                                node.send(original);
                                sent = true;
                                doneClose = true;
                            }

                            if (actualDistance > 1 && !doneFar) {
                                util.log("      -> Sending to far node " + node.client.id);
                                node.send(original);
                                sent = true;
                                doneFar = true;
                            }
                        } else if (node.distances.lat && node.distances.lon && data.distances.lat && data.distances.lon) {
                            var kmdistance = IPLocator.distanceFunction(node.distances, data.distances);
                            util.log("    -> distance in km:" + kmdistance, node.distances, data.distances);

                            if (kmdistance <= 300 && !doneClose) {
                                util.log("      -> Sending to close node " + node.client.id);
                                node.send(original);
                                sent = true;
                                doneClose = true;
                            }

                            if (actualDistance > 300 && !doneFar) {
                                util.log("      -> Sending to far node " + node.client.id);
                                node.send(original);
                                sent = true;
                                doneFar = true;
                            }
                        } else {
                            util.error("No distances", node.distances);
                        }
                    }
                } else {
                    deadNodes.push(node.client.id);
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
            util.log("  -> No suitable nodes found.");
        }
        if (deadNodes.length > 0) {
            util.log("Removed nodes: " + deadNodes);
            nodes.removeAllNodes(deadNodes);
        }

    }
    else if (message.type == "LRW") {
        //TODO CRITICAL! we get in here!
        util.log("ERROR!!!");
        util.log(message);
        util.log("ERROR!!!");
    }
    else if (message.type == "FRW") {
        util.log("ERROR!!!");
        util.log(message);
        util.log("ERROR!!!");
    }
    else if (message.type == "DU") {
        socket.distances = message.data.distances;
        util.log("Updated distances for peer " + socket.client.id + ":" + socket.distances)
    } else {
        if (message.destination != null) {
            //Try to send do destination, on failure back to default behaviour.
            var node = nodes.getNode(message.destination);
            if (node && node.readyState == 1) {
                util.log("Destination message: " + message.type);
                util.log("   -> Sending to " + message.destination);
                try {
                    node.send(message);
                } catch (e) {
                    util.log("Destination message cancelled:");
                    this.broadcast(message, nodes, socket);

                }
                return;
            }
        }
        this.broadcast(message, nodes, socket);
    }
};
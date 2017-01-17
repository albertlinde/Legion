var express = require('express');
var helmet = require('helmet');
var url = require('url');
var path = require('path');
var http = require('http');
var https = require('https');

var fs = require('fs');

var Config = require('./config.js');

var privateKey = fs.readFileSync(Config.signalling.key);
var certificate = fs.readFileSync(Config.signalling.cert);
var publicKey = fs.readFileSync(Config.signalling.public_key);


var credentials = {key: privateKey, cert: certificate, publicKey: publicKey};

var app = express();
var httpApp = express();

app.use(helmet());

var http_port = Config.signalling.PORT_HTTP;
var https_port = Config.signalling.PORT_HTTPS;

var httpServer = http.createServer(httpApp);
var httpsServer = https.createServer(credentials, app);

app.use(function log(req, res, next) {
    console.log([req.method, req.url].join(' '));
    next();
});

app.use(function (req, res, next) {
    if (!req.secure) {
        console.log("- - SECURITY ISSUE: " + req.secure);
        console.log(JSON.stringify(req.headers));
        console.log("- - SECURITY END");
        res.end();
    }
    next();
});

app.get('/', function (req, res, next) {
    console.log("Got index.html");
    res.sendFile(path.resolve('./../../applications/examples/index.html'));
});

//Static files.
app.use("/node_modules", express.static(path.resolve('./../../node_modules')));
app.use("/applications", express.static(path.resolve('./../../applications/')));
app.use("/applications/examples", express.static(path.resolve('./../../applications/examples')));
app.use("/img", express.static(path.resolve('./../../applications/examples/img')));

//Last resort.
app.use(function (req, res, next) {
    res.send({code: "404", msg: "File not found."});
});

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({
    server: httpsServer,
    verifyClient: function (info, cb) {
        console.log("Verify Origin: " + "(HTTP" + info.req.httpVersion + "-" + info.req.method + ") " + info.origin + info.req.url);
        console.log("Verify Secure: " + (info.secure && info.req.upgrade));
        console.log("Verify Agent: " + info.req.headers["user-agent"]);
        cb(true);
    }
});

httpApp.get("*", function (req, res, next) {
    console.log("Redirecting " + req.headers.host + req.path + " to HTTPS.");
    res.redirect("https://" + req.headers.host + req.path);
});

httpServer.listen(http_port, function () {
    console.log('HTTP listening on ' + httpServer.address().port);
});

httpsServer.listen(https_port, function () {
    console.log('HTTPS listening on ' + httpsServer.address().port)
});

var Duplicates = require('./../shared/Duplicates.js').Duplicates;
var Compressor = require('./../shared/Compressor.js');
var distanceFunction = require('./../shared/Utils.js').distanceFunction;

var util = require('util');
var ALMap = require('./../shared/ALMap.js').ALMap;
var AuthServer = require('./Authserver.js').AuthServer;

initService();

function initService() {

    var duplicates = new Duplicates();

    var messageCount = 0;

    //TODO: on server re-boot message generation breaks.
    /**
     *
     * @param type {string}
     * @returns {{type: string, s: string, ID: number}}
     */
    var generateMessage = function (type) {
        return {
            type: type,
            s: Config.signalling.SENDER_ID,
            ID: ++messageCount
        };
    };

    var nodes = new NodesStructure();
    var authority = new AuthServer(credentials);

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
                                util.log("Reconnected with new socket " + parsed.client_id + ". Old was: " + socket.remoteID);
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
                    else if (parsed.type == "CR") {
                        /**
                         * @type{
                             * {distances: Array.<Number>,
                             * close: 1|0,
                             * far: 1|0,
                             * hop: 1}
                             * }
                         */
                        var data = parsed.data;
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

                    }
                    else if (parsed.type == "LRW") {
                        console.log("ERROR!!!");
                        console.log(message);
                        console.log("ERROR!!!");
                    }
                    else if (parsed.type == "FRW") {
                        console.log("ERROR!!!");
                        console.log(message);
                        console.log("ERROR!!!");
                    }
                    else if (parsed.type == "DU") {
                        socket.distances = parsed.data.distances;
                        console.log("Updated distances for peer " + socket.remoteID + ":" + socket.distances)
                    } else {
                        if (!duplicates.contains(parsed.s, parsed.ID)) {
                            duplicates.add(parsed.s, parsed.ID);

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
                                if (node.remoteID == parsed.s)continue;

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
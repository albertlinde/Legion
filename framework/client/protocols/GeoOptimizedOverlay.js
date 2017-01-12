/**
 *
 * When the server is first contacted: request a join to a close and a far node.
 *
 * keep L local links up using RW.
 * keep F far links up using RW.
 *
 *
 * @param overlay
 * @param legion
 * @constructor
 */

function GeoOptimizedOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;
    this.options = this.legion.options.overlayProtocol.parameters;

    var instance = this;
    this.legion.messagingAPI.setHandlerFor("ConnectRequest", function (message, original, connection) {
        instance.handleConnectRequest(message, original, connection)
    });
    this.legion.messagingAPI.setHandlerFor("LocalRandomWalk", function (message, original, connection) {
        instance.handleLocalRandomWalk(message, original, connection)
    });
    this.legion.messagingAPI.setHandlerFor("FarRandomWalk", function (message, original, connection) {
        instance.handleFarRandomWalk(message, original, connection)
    });
    this.legion.messagingAPI.setHandlerFor("DistancesUpdate", function (message, original, connection) {
        instance.handleDistancesUpdate(message, original, connection)
    });

    this.legion.bullyProtocol.setOnBullyCallback(function () {
        instance.bullyStatusChange();
    });

    setInterval(function () {
        //maintain local net
        instance.checkCloseNodes();
    }, this.options.CLOSE_NODES_TIMER);
    setInterval(function () {
        //maintain far net
        instance.checkFarNodes();
    }, this.options.FAR_NODES_TIMER);

    //used to know which are, and which will be, what.
    this.activeCloseNodes = [];
    this.futureCloseNodes = [];
    this.activeFarNodes = [];
    this.futureFarNodes = [];

    /**
     * Used to start in a controlled fashion.
     * @type {boolean}
     */
    this.first = true;
    /**
     * Last distance vector.
     * @type {Array.<Number> | null}
     */
    this.distances = null;

    /**
     * Parameterizable distance vector calculator.
     */
    this.locator = new this.options.locator(this.options.locations, function (data) {
        instance.start(data);
    });
    this.locator.start();

    /**
     * This is used to make sure a node is not "far" from all because it was stupid at starting.
     * @type {number}
     */
    this.TimesLocalCheckNoConnections = 0;
}

GeoOptimizedOverlay.prototype.handleConnectRequest = function (message, original, connection) {
    if (this.first)return;
    //console.log(original);
    //console.log(message);

    if (!this.overlay.hasPeer(message.s)) {
        var actualDist = distanceFunction(this.distances, message.data.distances);
        if (message.data.close && actualDist <= 1) {
            if (Math.random() < 0.3 || this.activeCloseNodes.length + this.futureCloseNodes.length < this.options.MAX_CLOSE_NODES) {
                this.futureCloseNodes.push(message.s);
                this.legion.connectionManager.connectPeer(message.s);
            }
        } else if (message.data.far && actualDist > 1) {
            if (Math.random() < 0.3 || this.activeFarNodes.length + this.futureFarNodes.length < this.options.MAX_FAR_NODES) {
                this.futureFarNodes.push(message.s);
                this.legion.connectionManager.connectPeer(message.s);
            }
        } else {
            console.error("Message has no close or far.")
        }
    } else {
        //console.log("ConnectRequest for existing peer");
    }
};

GeoOptimizedOverlay.prototype.handleLocalRandomWalk = function (message, original, connection) {
    //console.log(message);
    message.data.TTL--;
    if (message.data.TTL > 0) {
        //console.log("TTL>0, propagating");
        if (this.activeCloseNodes.length > 0) {
            var tries = message.data.nodes;
            message.data.nodes = 1;
            for (var i = 0; i < tries; i++) {
                var pos = Math.floor(this.activeCloseNodes.length * Math.random());
                if (this.activeCloseNodes[pos] == message.s) {
                    if (this.activeCloseNodes.length > tries + 1) {
                        tries++;
                    }
                } else {
                    this.legion.messagingAPI.sendTo(this.activeCloseNodes[pos], message, true);
                }
            }
        } else {
            //console.warn("Cant walk: no close nodes.");
        }
    } else {
        if (!this.overlay.hasPeer(message.s)) {
            var actualDist = distanceFunction(this.distances, message.data.distances);

            //console.log("TTL==0, keeping, dist:" + actualDist);
            if (actualDist < 2) {
                if (this.activeCloseNodes.length + this.futureCloseNodes.length < this.options.MAX_CLOSE_NODES) {
                    this.futureCloseNodes.push(message.s);
                    this.legion.connectionManager.connectPeer(message.s);
                }
            } else {
                if (this.activeFarNodes.length + this.futureFarNodes.length < this.options.MAX_FAR_NODES) {
                    this.futureFarNodes.push(message.s);
                    this.legion.connectionManager.connectPeer(message.s);
                }
            }
        } else {
            //console.log("TL==0, i have this peer already: " + message.s);
        }
    }
};

GeoOptimizedOverlay.prototype.handleFarRandomWalk = function (message, original, connection) {
    message.data.TTL--;
    if (message.data.TTL > 0) {
        if (this.activeCloseNodes.length > 0) {
            var tries = message.data.nodes;
            message.data.nodes = 1;
            for (var i = 0; i < tries; i++) {
                var pos = Math.floor(this.activeCloseNodes.length * Math.random());
                this.legion.messagingAPI.sendTo(this.activeCloseNodes[pos], message, true);
            }
        } else {
            //console.warn("Cant walk: no far nodes.");
        }
    } else {
        if (!this.overlay.hasPeer(message.s)) {
            var actualDist = distanceFunction(this.distances, message.data.distances);
            if (actualDist < 2) {
                if (this.activeCloseNodes.length + this.futureCloseNodes.length < this.options.MAX_CLOSE_NODES) {

                    this.futureCloseNodes.push(message.s);
                    this.legion.connectionManager.connectPeer(message.s);
                }
            } else {
                if (this.activeFarNodes.length + this.futureFarNodes.length < this.options.MAX_FAR_NODES) {
                    this.futureFarNodes.push(message.s);
                    this.legion.connectionManager.connectPeer(message.s);
                }
            }
        } else {
            //console.log("I have this peer already: " + message.s);
        }
    }
};

GeoOptimizedOverlay.prototype.handleDistancesUpdate = function (message, original, peerConnection) {

    var actualDist = distanceFunction(this.distances, message.data.distances);

    var ca = this.activeCloseNodes.indexOf(message.s);
    var cf = this.futureCloseNodes.indexOf(message.s);

    var fa = this.activeFarNodes.indexOf(message.s);
    var ff = this.futureFarNodes.indexOf(message.s);

    var sendDU = false;
    if (actualDist <= 1) {
        if (fa >= 0) {
            this.activeFarNodes = arraySlicer(this.activeFarNodes, fa);
            sendDU = true;
        }
        if (ff >= 0) {
            this.futureFarNodes = arraySlicer(this.futureFarNodes, fa);
            sendDU = true;
        }
        if (cf >= 0) {
            this.futureCloseNodes = arraySlicer(this.futureCloseNodes, fa);
        }
        if (ca < 0) {
            this.TimesLocalCheckNoConnections = 0;
            this.activeCloseNodes.push(message.s);
        }
    } else {
        if (ca >= 0) {
            this.activeCloseNodes = arraySlicer(this.activeCloseNodes, fa);
            sendDU = true;
        }
        if (cf >= 0) {
            this.futureCloseNodes = arraySlicer(this.futureCloseNodes, fa);
            sendDU = true;
        }
        if (ff >= 0) {
            this.futureFarNodes = arraySlicer(this.futureFarNodes, fa);
        }
        if (fa < 0) {
            this.activeFarNodes.push(message.s);
        }
    }
    if (sendDU) {
        this.legion.generateMessage("DistancesUpdate", {distances: this.distances}, function (result) {
            peerConnection.send(result);
        });
    }
};

/**
 * Initializes the protocol.
 * @param distances {Array.<Number>}
 */
GeoOptimizedOverlay.prototype.start = function (distances) {
    this.distances = distances;
    if (!this.legion.connectionManager.serverConnection) {
        this.legion.connectionManager.startSignallingConnection();
    } else {
        this.onServerConnection(this.legion.connectionManager.serverConnection);
    }
};

/**
 * Called periodically.
 */
GeoOptimizedOverlay.prototype.checkCloseNodes = function () {
    if (this.first)return;
    if (this.activeCloseNodes.length + this.futureCloseNodes.length < this.options.MIN_CLOSE_NODES) {
        this.TimesLocalCheckNoConnections++;
        var data = {
            distances: this.distances,
            nodes: this.options.MIN_CLOSE_NODES - (this.activeCloseNodes.length + this.futureCloseNodes.length),
            TTL: 2
        };

        if (Math.random() > 0.5) {
            data.TTL++;
        }
        if (Math.random() > 0.9) {
            data.TTL++;
        }

        var goo = this;
        if (this.activeCloseNodes.length == 0 || Math.random() < 0.3) {
            var extdata = {
                distances: this.distances,
                close: 1,
                far: 0
            };
            this.legion.generateMessage("ConnectRequest", extdata, function (result) {
                if (goo.legion.connectionManager.serverConnection) {
                    goo.legion.connectionManager.serverConnection.send(result);
                }
            });
        }
        if (this.activeCloseNodes.length > 0) {
            this.legion.generateMessage("LocalRandomWalk", data, function (result) {
                if (goo.activeCloseNodes.length > 0) {
                    var pos = Math.floor(goo.activeCloseNodes.length * Math.random());
                    goo.legion.messagingAPI.sendTo(goo.activeCloseNodes[pos], result, true);
                } else {
                    console.warn("Cant walk: no far nodes.");
                }
            });
        }
    }

    this.bullyStatusChange();

    if (this.activeCloseNodes.length > this.options.MAX_CLOSE_NODES) {
        var min = Number.MAX_SAFE_INTEGER;
        for (var i = 0; i < this.activeCloseNodes.length; i++) {
            if (min > this.activeCloseNodes[i] && this.activeCloseNodes[i] != this.legion.bullyProtocol.bully) {
                min = this.activeCloseNodes[i];
            }
        }

        if (this.legion.bullyProtocol.amBullied()) {
            this.overlay.getPeer(min).close();
        } else {
            var pos = Math.floor(goo.activeCloseNodes.length * Math.random());
            if (min == this.activeCloseNodes[pos]) {
                //give the min node another chance to not be chosen.
                pos = Math.floor(goo.activeCloseNodes.length * Math.random());
            }
            this.overlay.getPeer(pos).close();
        }
    }

    if (this.TimesLocalCheckNoConnections >= this.options.LOCAL_FAILS_TILL_RESET) {
        this.TimesLocalCheckNoConnections = 0;
        //TODO: uncomment this for changes to ahppen in distance vecto: this.locator.start();
    }
};

/**
 * Called periodically.
 */
GeoOptimizedOverlay.prototype.checkFarNodes = function () {
    if (this.first)return;

    if (this.activeFarNodes.length + this.futureFarNodes.length < this.options.MIN_FAR_NODES) {
        var data = {
            distances: this.distances,
            nodes: this.options.MIN_FAR_NODES - (this.activeFarNodes.length + this.futureFarNodes.length),
            TTL: 2
        };

        var goo = this;
        if (this.activeFarNodes.length == 0) {
            data = {
                distances: this.distances,
                close: 0,
                far: 1
            };
            this.legion.generateMessage("ConnectRequest", data, function (result) {
                if (goo.legion.connectionManager.serverConnection) {
                    goo.legion.connectionManager.serverConnection.send(result);
                }
            });
        } else {
            this.legion.generateMessage("FarRandomWalk", data, function (result) {
                if (goo.activeFarNodes.length > 0) {
                    var pos = Math.floor(goo.activeFarNodes.length * Math.random());
                    goo.legion.messagingAPI.sendTo(goo.activeFarNodes[pos], result, true);
                } else {
                    console.warn("Cant walk: no far nodes.");
                }
            });
        }
    }
    if (this.activeFarNodes.length > this.options.MAX_FAR_NODES) {
        var pos = Math.floor(this.activeFarNodes.length * Math.random());
        this.overlay.getPeer(this.activeFarNodes[pos]).close();
    }
};

GeoOptimizedOverlay.prototype.bullyStatusChange = function () {
    { //If I am a bully I must be connected to the signalling server.
        if (!this.legion.bullyProtocol.amBullied()) {
            if (!this.legion.connectionManager.serverConnection) {
                console.log("Starting signalling connection.");
                this.legion.connectionManager.startSignallingConnection();
            }
        }
    }
    { //If I am bullied I must not be connected to the signalling server.
        if (this.legion.bullyProtocol.amBullied()) {
            if (this.legion.connectionManager.serverConnection) {
                //if no far and connected locally in progress:
                if (this.futureFarNodes.length == 0 && this.activeCloseNodes.length > 0) {
                    console.log("Stopping signalling connection.");
                    this.legion.connectionManager.serverConnection.close();
                }
            }
        }
    }
};

GeoOptimizedOverlay.prototype.onClientConnection = function (peerConnection) {
    peerConnection.distances = -1;
    for (var i = 0; i < this.futureCloseNodes.length; i++) {
        if (this.futureCloseNodes[i] == peerConnection.remoteID) {
            this.futureCloseNodes = arraySlicer(this.futureCloseNodes, i);
            this.legion.generateMessage("DistancesUpdate", {distances: this.distances}, function (result) {
                peerConnection.send(result);
            });
            peerConnection.distances = 1;
            this.activeCloseNodes.push(peerConnection.remoteID);
            this.TimesLocalCheckNoConnections = 0;
            return;
        }
    }
    for (var j = 0; j < this.futureFarNodes.length; j++) {
        if (this.futureFarNodes[j] == peerConnection.remoteID) {
            this.futureFarNodes = arraySlicer(this.futureFarNodes, j);
            this.legion.generateMessage("DistancesUpdate", {distances: this.distances}, function (result) {
                peerConnection.send(result);
            });
            peerConnection.distances = 2;
            this.activeFarNodes.push(peerConnection.remoteID);
            return;
        }
    }
    //Did not find node. Do nothing: expecting a message.
};


GeoOptimizedOverlay.prototype.onClientDisconnect = function (peerConnection) {
    for (var i = 0; i < this.futureCloseNodes.length; i++) {
        if (this.futureCloseNodes[i] == peerConnection.remoteID) {
            this.futureCloseNodes = arraySlicer(this.futureCloseNodes, i);
            return;
        }
    }
    for (var j = 0; j < this.futureFarNodes.length; j++) {
        if (this.futureFarNodes[j] == peerConnection.remoteID) {
            this.futureFarNodes = arraySlicer(this.futureFarNodes, j);
            return;
        }
    }
    for (var j = 0; j < this.activeFarNodes.length; j++) {
        if (this.activeFarNodes[j] == peerConnection.remoteID) {
            this.activeFarNodes = arraySlicer(this.activeFarNodes, j);
            return;
        }
    }
    for (var i = 0; i < this.activeCloseNodes.length; i++) {
        if (this.activeCloseNodes[i] == peerConnection.remoteID) {
            this.activeCloseNodes = arraySlicer(this.activeCloseNodes, i);
            return;
        }
    }
};

GeoOptimizedOverlay.prototype.onServerConnection = function (serverConnection) {
    var goo = this;
    if (this.first) {
        if (!this.distances) {
            //console.warn("No distances set yet.");
            return;
        }
        this.first = false;

        var data = {
            distances: this.distances,
            close: 1,
            far: 1
        };

        this.legion.generateMessage("ConnectRequest", data, function (result) {
            if (goo.legion.connectionManager.serverConnection) {
                goo.legion.connectionManager.serverConnection.send(result);
            } else {
                console.warn("Tried ConnectRequest, no server.");
            }
        });
    } else {
        this.legion.generateMessage("DistancesUpdate", {distances: this.distances}, function (result) {
            goo.legion.messagingAPI.broadcastMessage(result);
        });
    }
};

GeoOptimizedOverlay.prototype.geClosePeerIDs = function () {
    return this.activeCloseNodes;
};
GeoOptimizedOverlay.prototype.getClosePeers = function () {
    var peers = [];
    for (var i = 0; i < this.activeCloseNodes.length; i++) {
        peers.push(this.overlay.getPeer(this.activeCloseNodes[i]));
    }
    return peers;
};

GeoOptimizedOverlay.prototype.onServerDisconnect = function (serverConnection) {
    var o = this;
    if (this.first) {
        setTimeout(function () {
            o.legion.connectionManager.startSignallingConnection();
        }, 1250);
    } else {
        //no op, timer will handle this.
    }
};
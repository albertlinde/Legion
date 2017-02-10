var bullyLog = true;
function ServerBully(legion) {
    this.legion = legion;

    this.lastSHB = null;

    var sb = this;
    this.handlers = {
        bully: {
            type: "SHB",
            callback: function (message, connection) {
                if (connection instanceof ServerConnection) {
                    if (sb.amBullied()) {
                        //Have a bully, ServerConnection is probably in cleanup stage.
                        console.log("Got SHB from server but am bullied by " + sb.bully);
                    } else {
                        console.log("Got SHB from server.");
                        sb.lastSHB = message;
                        sb.bully = (sb.legion.id).toString();
                        sb.bullied();

                        if (message.KeyID > sb.legion.secure.getCurrentKeyID()) {
                            connection.socket.send(sb.legion.secure.getServerAuthenticationChallenge());
                        } else
                            sb.floodBully();
                    }
                } else {
                    if (sb.legion.secure.verifySHB(message)) {
                        console.log("Got SHB from peer: " + connection.remoteID);
                        var hisID = connection.remoteID;
                        if (hisID <= sb.bully) {
                            sb.lastSHB = message;
                            if (sb.bully != hisID) {
                                sb.bully = hisID;
                                sb.bullied();
                            }
                            if (typeof bullyLog != "undefined" && bullyLog)
                                console.log("Be bullied by: " + hisID);
                        } else {
                            if (typeof bullyLog != "undefined" && bullyLog)
                                console.log("Be bullied by: " + hisID + " but bully is: " + sb.bully);
                            sb.onClientConnection(connection);
                        }
                    } else {
                        console.warn("Error on verifying SHB");
                        console.warn(message);
                        //No op.
                    }
                }
            }
        }
    };
    if (this.legion.id) {
        this.bully = (this.legion.id).toString();
    }
    this.legion.messagingAPI.setHandlerFor(this.handlers.bully.type, this.handlers.bully.callback);
    this.callbacks = [];
}

ServerBully.prototype.setOnBullyCallback = function (cb) {
    this.callbacks.push(cb);
};

ServerBully.prototype.bullied = function () {
    var arg = this.amBullied();
    for (var i = 0; i < this.callbacks.length; i++) {
        this.callbacks[i](arg);
    }
};

ServerBully.prototype.onClientConnection = function (peerConnection) {
    if (!this.amBullied() && this.lastSHB) {
        if (typeof bullyLog != "undefined" && bullyLog)
            console.log("Being immediate bully to: " + peerConnection.remoteID);
        peerConnection.send(this.lastSHB);
    }
};

ServerBully.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
    if (peerConnection.remoteID == this.bully) {
        if (typeof bullyLog != "undefined" && bullyLog)
            console.log("Lost bully: " + peerConnection.remoteID);
        var mustReconnect = true;
        var myBullyID = (this.legion.id).toString();
        if (this.legion.overlay.overlayProtocol instanceof GeoOptimizedOverlay) {
            var peers = this.legion.overlay.getPeerIDs();
            for (var i = 0; i < peers.length; i++) {
                if (peers[i] > myBullyID) {
                    mustReconnect = false;
                    break;
                }
            }
        } else {
            var peers = this.legion.overlay.overlayProtocol.geClosePeerIDs();
            for (var i = 0; i < peers.length; i++) {
                if (peers[i] > myBullyID) {
                    mustReconnect = false;
                    break;
                }
            }
        }

        if (mustReconnect) {
            this.bully = myBullyID;
            this.bullied();
            this.floodBully();
            if (typeof bullyLog != "undefined" && bullyLog)
                console.log("Forcing bully.");
        } else {
            if (typeof bullyLog != "undefined" && bullyLog)
                console.log("Not forcing bully.");
        }
    }
};

ServerBully.prototype.onServerConnection = function (serverConnection) {
    if (!this.bully) {
        if (this.legion.id) {
            this.bully = (this.legion.id).toString();
        }
    }
    //No op.
};

ServerBully.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

/**
 * Returns true if node has a bully.
 * False if the node is itself a bully.
 * NOTE: true on startup.
 * @returns {boolean}
 */
ServerBully.prototype.amBullied = function () {
    if (!this.legion.id) return false;
    if (this.bully == (this.legion.id).toString() || this.bully == "TEMP_ID" || !this.lastSHB)
        return false;
    var time = (Date.now()) - (this.lastSHB.timestamp + this.lastSHB.validity);
    return time <= 0;
};

//TODO: bullying goes to higher ids.

ServerBully.prototype.floodBully = function () {
    if (!this.amBullied()) {
        var peers = [];
        if (this.legion.overlay.overlayProtocol instanceof GeoOptimizedOverlay) {
            if (typeof bullyLog != "undefined" && bullyLog)
                console.info("Bully: GeoOptimizedOverlay Flood.");
            peers = this.legion.overlay.overlayProtocol.getClosePeers();

        } else {
            if (typeof bullyLog != "undefined" && bullyLog)
                console.info("Bully: Regular Flood.");
            peers = this.legion.overlay.getPeers(this.legion.overlay.peerCount());
        }

        for (var i = 0; i < peers.length; i++) {
            peers[i].send(this.lastSHB);
            if (typeof bullyLog != "undefined" && bullyLog)
                console.log("Being bully to", peers[i].remoteID);
        }

    } else {
        if (typeof bullyLog != "undefined" && bullyLog)
            console.log("My bully: " + this.bully);
    }
};

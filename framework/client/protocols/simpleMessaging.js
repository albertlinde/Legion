function FloodMessaging(api, legion) {
    this.messagingAPI = api;
    this.legion = legion;
}

FloodMessaging.prototype.onMessage = function (connection, message, original) {
    if (!message.destination || (message.destination && message.destination != this.legion.id)) {
        if (connection instanceof PeerConnection)
            this.broadcastMessage(original, [connection]);
        else {
            if (debug)
                console.log("Not broadcasting: " + message.type, this.legion.id, message.sender)
        }
    }
};

FloodMessaging.prototype.sendTo = function (peer, message, dontSetDestination) {
    var o = this;
    if (!dontSetDestination || message.destination) {
        message.destination = peer;
        this.broadcastMessage(message, []);
    } else {
        if (message.type.startsWith("OS:")) {
            if (message.data) {
                console.error("sendTo in simpleMessaging")
            }
            this.legion.objectStore.peerSyncs.get(peer).send(message);
        } else {
            if (message.data) {
                compress(JSON.stringify(message.data), function (response) {
                    message.compressed = response;
                    delete message.data;
                    o.legion.overlay.getPeer(peer).send(message);

                }, function (error) {
                    console.error("Compress failed!", error);
                });
            } else {
                this.legion.overlay.getPeer(peer).send(message);
            }
        }
    }
};

/**
 *
 * Assumes message is ready to be sent.
 * @param message {Object}
 * @param except {Array.<PeerConnection, ServerConnection>}
 * @param useFanout .{boolean} Ensures sending to subset (2).
 */
FloodMessaging.prototype.broadcastMessage = function (message, except, useFanout) {

    if (message.compressed && message.data) {
        console.error(message);
    }
    var peers = this.legion.overlay.getPeers(this.legion.overlay.peerCount());

    if (message.destination) {
        var peer = this.legion.overlay.getPeer(message.destination);
        if (peer) {
            if (message.type.startsWith("OS:")) {
                this.legion.objectStore.peerSyncs.get(peer.remoteID).send(message);
            } else {
                peer.send(message);
            }
            return;
        }
    }
    var max = peers.length;
    if (useFanout) {
        max = 2;
    }
    var sent = 0;
    for (var i = 0; sent < max && i < peers.length; i++) {
        if (peers[i].remoteID == message.sender)
            continue;
        var send = true;
        for (var j = 0; send && except && j < except.length; j++)
            if (except[j] && (peers[i].remoteID == except[j].remoteID))
                send = false;
        if (send) {
            if (message.type.startsWith("OS:")) {
                this.legion.objectStore.peerSyncs.get(peers[i].remoteID).send(message);
            } else {
                peers[i].send(message);
            }
            sent++;
        }
    }
    var server = this.legion.connectionManager.serverConnection;
    if (server) {
        for (var i = 0; except && i < except.length; i++)
            if (except[i] && (server.remoteID == except[i].remoteID))
                return;
        if (message.type.startsWith("OS:")) {
            if (this.legion.objectStore.objectServer) {
                this.legion.objectStore.objectServer.send(message);
            }
        } else {
            server.send(message);
        }
    }
};
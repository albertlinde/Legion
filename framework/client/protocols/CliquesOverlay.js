function CliquesOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;

    var so = this;
    this.interval = setInterval(function () {
        so.floodJoin();
    }, legion.options.overlayProtocol.parameters.floodInterval);
    this.started = false;

    setTimeout(function () {
        so.floodJoin();
    }, 3 * 1000);

    this.legion.messagingAPI.setHandlerFor("Connect", function (message, original, connection) {
        so.handleJoin(message, original, connection)
    });

    this.legion.bullyProtocol.setOnBullyCallback(function (b) {
        so.bullyStatusChange();
    });
}

CliquesOverlay.prototype.bullyStatusChange = function () {
    if (this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection) {
            this.legion.connectionManager.serverConnection.close()
        }
    } else {
        if (!this.legion.connectionManager.serverConnection) {
            this.legion.connectionManager.startSignallingConnection();
        }
    }
};

CliquesOverlay.prototype.onClientConnection = function (peerConnection) {
    if (this.legion.bullyProtocol.amBullied()) {

    } else
        this.floodJoin();
};

CliquesOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

CliquesOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init();
};

CliquesOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

CliquesOverlay.prototype.init = function (contact_node) {
    this.floodJoin();
};

CliquesOverlay.prototype.floodJoin = function () {
    var serverConnection = this.legion.connectionManager.serverConnection;

    if (!serverConnection) {
        if (!this.legion.bullyProtocol.amBullied()) {
            this.legion.connectionManager.startSignallingConnection();
        }
    }
    var so = this;
    this.legion.generateMessage("Connect", null, function (result) {
        so.legion.messagingAPI.broadcastMessage(result);
    });
};

CliquesOverlay.prototype.handleJoin = function (message, original, connection) {
    if (!this.legion.connectionManager.hasPeer(message.s)) {
        this.legion.connectionManager.connectPeer(message.s);
    }

    if (connection instanceof PeerConnection && connection.remoteID == message.s) {
        this.legion.messagingAPI.broadcastMessage(original, [connection]);
    }
};
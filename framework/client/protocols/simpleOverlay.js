function SimpleOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;

    var so = this;
    this.interval = setInterval(function () {
        so.floodJoin();
    }, 15 * 1000);
    this.started = false;

    setTimeout(function () {
        so.floodJoin();
    }, 2 * 1000);

    this.legion.messagingAPI.setHandlerFor("ConnectToAnyNodesPlease", function (message, connection) {
        so.handleJoin(message, connection)
    });
}

SimpleOverlay.prototype.onClientConnection = function (peerConnection) {
    if (this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection)
            this.legion.connectionManager.serverConnection.socket.close();
    }
    this.floodJoin();
};

SimpleOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

SimpleOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init();
};

SimpleOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

SimpleOverlay.prototype.init = function (contact_node) {
    this.floodJoin();
};

SimpleOverlay.prototype.floodJoin = function () {
    //random sample of peers
    var peers = this.overlay.getPeers(this.overlay.peerCount());

    if (!this.started) {
        var serverConnection = this.legion.connectionManager.serverConnection;

        if (!serverConnection) {
            //this forces a connection to the server.
            if (!this.legion.bullyProtocol.amBullied()) {
                this.legion.connectionManager.startSignallingConnection();
            }
        }
        this.started = true;
    }
    var so = this;
    this.legion.generateMessage("ConnectToAnyNodesPlease", null, function (result) {
        so.legion.messagingAPI.broadcastMessage(result);
    });
};

SimpleOverlay.prototype.handleJoin = function (message, connection) {
    if (!this.legion.connectionManager.hasPeer(message.s)) {
        if (this.overlay.peerCount() <= 1)
            this.legion.connectionManager.connectPeer(message.s);
    }

    this.legion.messagingAPI.broadcastMessage(message, [connection]);

    if (this.legion.bullyProtocol.amBullied()) {
        if (this.legion.connectionManager.serverConnection) {
            this.legion.connectionManager.serverConnection.close()
        }
    }
};
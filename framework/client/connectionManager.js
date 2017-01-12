function ConnectionManager(legion) {
    this.legion = legion;
    this.serverConnection = null;

    this.peerConnections = new ALMap();

    var cm = this;
    //TODO: the following strings are defined where?
    this.legion.messagingAPI.setHandlerFor("OfferAsAnswer", function (message, original) {
        cm.handleSignalling(message, original)
    });
    this.legion.messagingAPI.setHandlerFor("OfferReturn", function (message, original) {
        cm.handleSignalling(message, original)
    });
    this.legion.messagingAPI.setHandlerFor("ICE", function (message, original) {
        cm.handleSignalling(message, original)
    });

    this.isStartingserverConnection = false;
}

ConnectionManager.prototype.startSignallingConnection = function () {
    if (this.legion.options.signallingConnection.type == "NONE") {
        return;
    }

    if (!this.serverConnection && !this.isStartingserverConnection) {
        //TODO: this can fail. should be restarted. timeout?
        new this.legion.options.signallingConnection.type(this.legion.options.signallingConnection.server, this.legion);
        this.isStartingserverConnection = true;
    }
};

ConnectionManager.prototype.hasPeer = function (peerID) {
    return this.peerConnections.contains(peerID);
};

//assumes peer does not exist
ConnectionManager.prototype.connectPeer = function (peerID) {
    //TODO: remove assumption
    if (this.hasPeer(peerID)) {
        return false;
    } else {
        this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
        this.peerConnections.get(peerID).startLocal();
        return true;
    }
};

//if it had the peer, the winning started is te one with lowest id.
ConnectionManager.prototype.connectPeerRemote = function (message) {
    //TODO: decision is based by id. is this the best way?
    var peerID = message.s;
    var offer = message.data;
    var hadPeer = this.peerConnections.get(peerID);
    if (hadPeer) {
        if (peerID < this.legion.id) {
            //He wins.
            this.peerConnections.get(peerID).cancelAll();
            this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
            this.peerConnections.get(peerID).startRemote(offer, message.unique);
        } else {
            //I win.
        }
    } else {
        this.peerConnections.set(peerID, new PeerConnection(peerID, this.legion));
        this.peerConnections.get(peerID).startRemote(offer, message.unique);
    }
};

ConnectionManager.prototype.handleSignalling = function (message, original) {
    //TODO: again, this isn't well defined.
    //TODO: message.unique is not explained anywhere.
    if (message.destination != this.legion.id) {
        this.legion.messagingAPI.broadcastMessage(original);
    } else {
        if (message.type == "OfferAsAnswer") {
            this.connectPeerRemote(message);
        } else {
            var unique = message.unique;
            if (this.peerConnections.contains(message.s)) {
                var pc = this.peerConnections.get(message.s);
                if (pc.unique != unique) {
                    console.warn("Got as unique", unique, "when expecting", pc.unique);
                } else {
                    switch (message.type) {
                        case "OfferReturn":
                            pc.returnOffer(message.data);
                            return;
                        case "ICE":
                            pc.return_ice(message.data);
                            return;
                    }
                }
            } else {
                console.warn("Got", message.type, "for no peer", message.s, this.legion.id);
            }
        }
    }
};

ConnectionManager.prototype.onCloseServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + serverConnection.remoteID + " of type " + (serverConnection.constructor.name));
    if (serverConnection instanceof this.legion.options.signallingConnection.type) {
        this.serverConnection = null;
        this.isStartingserverConnection = false;
    }
    if (this.legion.options.objectServerConnection.type != "NONE") {
        if (serverConnection instanceof this.legion.options.objectServerConnection.type) {
            this.legion.objectStore.onServerDisconnect(serverConnection);
        }
    }
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerDisconnect(serverConnection);
    this.legion.overlay.onServerDisconnect(serverConnection);
};

ConnectionManager.prototype.onOpenServer = function (serverConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + serverConnection.remoteID + " of type " + (serverConnection.constructor.name));
    if (serverConnection instanceof this.legion.options.signallingConnection.type) {
        this.serverConnection = serverConnection;
    }
    if (this.legion.options.objectServerConnection.type != "NONE") {
        if (serverConnection instanceof this.legion.options.objectServerConnection.type) {
            this.legion.objectStore.onServerConnection(serverConnection);
        }
    }
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerConnection(serverConnection);
    this.legion.onOpenServer(serverConnection);
    this.legion.overlay.onServerConnection(serverConnection);
};

ConnectionManager.prototype.onOpenClient = function (clientConnection) {
    console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + clientConnection.remoteID);
    this.legion.overlay.addPeer(clientConnection);
    //TODO: the ifs will be void.
    if (this.legion.objectStore)
        this.legion.objectStore.onClientConnection(clientConnection);
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onClientConnection(clientConnection);
};

ConnectionManager.prototype.onCloseClient = function (clientConnection) {
    if (this.peerConnections.contains(clientConnection.remoteID)) {
        console.log(this.legion.getTime() + " Overlay CLOSE " + this.legion.id + " to " + clientConnection.remoteID);
        this.peerConnections.delete(clientConnection.remoteID);
        this.legion.overlay.removePeer(clientConnection);
        //TODO: the ifs will be void.
        if (this.legion.objectStore)
            this.legion.objectStore.onClientDisconnect(clientConnection);
        if (this.legion.bullyProtocol)
            this.legion.bullyProtocol.onClientDisconnect(clientConnection);
    }
};

ConnectionManager.prototype.sendStartOffer = function (offer, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("OfferAsAnswer", offer, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendReturnOffer = function (offer, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("OfferReturn", offer, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendICE = function (candidate, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("ICE", candidate, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};



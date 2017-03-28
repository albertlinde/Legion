function ConnectionManager(legion) {
    this.legion = legion;
    this.serverConnection = null;

    this.peerConnections = new ALMap();

    var cm = this;
    //TODO: the following strings are defined where?
    this.legion.messagingAPI.setHandlerFor("C:OA", function (message) {
        cm.handleSignalling(message)
    });
    this.legion.messagingAPI.setHandlerFor("C:OR", function (message) {
        cm.handleSignalling(message)
    });
    this.legion.messagingAPI.setHandlerFor("C:I", function (message) {
        cm.handleSignalling(message)
    });

    this.legion.messagingAPI.setHandlerFor("AuthResponse", function (message) {
        console.log("TODO: CM.authresponse")
    });

    this.legion.messagingAPI.setHandlerFor("NoGroup", function (message) {
        console.log("Group did not exist.");
        if (!cm.sendingGC) {
            cm.sendingGC = true;
            cm.legion.generateMessage("CreateGroup", null, function (msg) {
                msg.group = cm.legion.group;
                cm.serverConnection.send(msg);
            });
        }
    });

    this.legion.messagingAPI.setHandlerFor("JoinGroupAnswer", function (message) {
        if (message.success) {
            if (cm.onJoinCallback) {
                cm.onJoinCallback(cm.legion);
            }
        } else {
            if (cm.onFailCallback) {
                cm.onFailCallback(message);
            }
        }
    });

    this.isStartingserverConnection = false;

    this.group = null;
    this.onJoinCallback = null;
    this.onFailCallback = null;
    this.onSyncCallback = null;
    this.debug = false;
}

ConnectionManager.prototype.joinGroup = function (groupOptions, onJoinCallback, onSyncCallback, onFailCallback) {
    if (this.tryJoin) {
        console.error("Multiple groups not allowed.");
        return;
    }
    var cm = this;
    var doneJoin = function () {
        cm.legion.generateMessage("JoinGroup", groupOptions, function (m) {
            cm.serverConnection.send(m);
        });
    };

    this.tryJoin = true;
    this.group = groupOptions;
    this.onJoinCallback = onJoinCallback;
    this.onFailCallback = onFailCallback;
    this.onSyncCallback = onSyncCallback;
    if (this.legion.joined) {
        doneJoin();
    } else {
        this.internalJoinCallback = doneJoin;
    }
};

ConnectionManager.prototype.startSignallingConnection = function () {
    if (this.legion.options.signallingConnection.type == "NONE") {
        return;
    }

    if (!this.serverConnection && !this.isStartingserverConnection) {
        //TODO: this can fail. should be restarted. timeout?
        new this.legion.options.signallingConnection.type(this.legion.options.signallingConnection.server, this.legion);
        this.isStartingserverConnection = true;
        var cm = this;
        setTimeout(function () {
            cm.isStartingserverConnection = false;
        }, 4000);
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

ConnectionManager.prototype.handleSignalling = function (message) {
    //TODO: again, this isn't well defined.
    //TODO: message.unique is not explained anywhere.
    if (message.destination != this.legion.id) {
        this.legion.messagingAPI.broadcastMessage(message);
    } else {
        if (message.type == "C:OA") {
            this.connectPeerRemote(message);
        } else {
            var unique = message.unique;
            if (this.peerConnections.contains(message.s)) {
                var pc = this.peerConnections.get(message.s);
                if (pc.unique != unique) {
                    console.warn("Got as unique", unique, "when expecting", pc.unique);
                } else {
                    switch (message.type) {
                        case "C:OR":
                            pc.returnOffer(message.data);
                            return;
                        case "C:I":
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
    if (this.debug)
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
    if (this.debug)
        console.log(this.legion.getTime() + " Overlay OPEN " + this.legion.id + " to " + serverConnection.remoteID + " of type " + (serverConnection.constructor.name));
    if (serverConnection instanceof this.legion.options.signallingConnection.type) {
        this.serverConnection = serverConnection;
        if (this.internalJoinCallback) {
            this.internalJoinCallback();
            this.internalJoinCallback = null;
        }
    }
    if (this.legion.options.objectServerConnection.type != "NONE") {
        if (serverConnection instanceof this.legion.options.objectServerConnection.type) {
            this.legion.objectStore.onServerConnection(serverConnection);
        }
    }
    if (this.legion.bullyProtocol)
        this.legion.bullyProtocol.onServerConnection(serverConnection);
    this.legion.overlay.onServerConnection(serverConnection);
};

ConnectionManager.prototype.onOpenClient = function (clientConnection) {
    if (this.debug)
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
        if (this.debug)
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
    this.legion.generateMessage("C:OA", offer, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendReturnOffer = function (offer, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("C:OR", offer, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};

ConnectionManager.prototype.sendICE = function (candidate, unique, clientConnection) {
    var cm = this;
    //TODO: see CM.constructor
    this.legion.generateMessage("C:I", candidate, function (result) {
        result.destination = clientConnection.remoteID;
        result.unique = unique;
        cm.legion.messagingAPI.broadcastMessage(result);
    });
};



function RandomGraphOverlay(overlay, legion) {
    this.overlay = overlay;
    this.legion = legion;

    this.parameters = legion.options.overlayProtocol.parameters;

    var bo = this;

    this.legion.messagingAPI.setHandlerFor("P2PMeta", function (message, connection) {
        bo.gotP2PMeta(message, connection)
    });
    this.legion.messagingAPI.setHandlerFor("JoinRequest", function (message, connection) {
        bo.onJoinRequest(message, connection)
    });
    this.legion.messagingAPI.setHandlerFor("JoinAnswer", function (message, connection) {
        bo.onJoinAnswer(message, connection)
    });

    var meta_timeout = function () {
        bo.sendP2PMeta();
        bo.parameters.meta_interval = Math.min(bo.parameters.meta_interval + 2500, 35 * 1000);
        setTimeout(meta_timeout, bo.parameters.meta_interval);
    };
    setTimeout(meta_timeout, bo.parameters.meta_interval);

    var timeout_check = function () {
        bo.bullyStatusChange();
        var did_reconnect = false;
        if (bo.overlay.peerCount() < bo.parameters.min) {
            bo.legion.generateMessage("JoinRequest", null, function (result) {
                result.N = bo.parameters.max - bo.overlay.peerCount();
                result.TTL = bo.parameters.initial_ttl;
                bo.legion.messagingAPI.propagateToN(result, true);
            });

            did_reconnect = true;
        }
        if (bo.overlay.peerCount() > bo.parameters.max) {
            bo.removeBestPeer();
        }
        if (did_reconnect) {
            setTimeout(timeout_check, bo.parameters.conn_check_timeout);
        } else {
            setTimeout(timeout_check, Math.min(30, bo.parameters.conn_check_timeout * bo.parameters.conn_check_timeout_multiplier));
        }
    };

    this.legion.bullyProtocol.setOnBullyCallback(function (b) {
        bo.bullyStatusChange();
    });

    setTimeout(timeout_check, bo.parameters.conn_check_timeout_startup);
}

RandomGraphOverlay.prototype.onClientConnection = function (peerConnection) {
    var bo = this;
    this.legion.generateMessage("P2PMeta", null, function (result) {
        result.meta = {
            server: !bo.legion.bullyProtocol.amBullied(),
            peers: bo.legion.overlay.peerCount()
        };
        peerConnection.send(result);
    });
    setTimeout(function () {
        bo.bullyStatusChange()
    }, 2000);
};

RandomGraphOverlay.prototype.bullyStatusChange = function () {
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

RandomGraphOverlay.prototype.onClientDisconnect = function (peerConnection) {
    //No op.
};

RandomGraphOverlay.prototype.onServerConnection = function (serverConnection) {
    this.init(serverConnection);
};

RandomGraphOverlay.prototype.onServerDisconnect = function (serverConnection) {
    //No op.
};

RandomGraphOverlay.prototype.init = function (contact_node) {
    var bo = this;
    if (this.overlay.peerCount() > this.parameters.min)
        return;
    if (this.overlay.peerCount() == 0) {
        this.legion.generateMessage('JoinRequest', null, function (result) {
            result.N = bo.parameters.initial_n;
            result.TTL = bo.parameters.initial_ttl;
            contact_node.send(result);
        });
    } else {
        this.legion.generateMessage('JoinRequest', null, function (result) {
            result.N = bo.parameters.max - bo.overlay.peerCount();
            result.TTL = bo.parameters.initial_ttl;
            contact_node.send(result);
        });
    }
};

RandomGraphOverlay.prototype.onJoinRequest = function (message, connection) {
    if (this.overlay.peers.contains(message.s)) {
        message.TTL--;
        if (message.N > 0 && message.TTL > 0) {
            this.legion.messagingAPI.propagateToN(message);
        }
    } else {
        var connected = false;
        if (this.overlay.peerCount() < this.parameters.min) {
            connected = true;
        } else if (message.TTL == 0 || !(connection instanceof  PeerConnection)) {
            connected = true;
        } else if (this.overlay.peerCount() < this.parameters.max) {
            if (this.legion.bullyProtocol.amBullied() && Math.random() < (1 - this.parameters.RAND_VAL)) {
                connected = true;
            } else if (!this.legion.bullyProtocol.amBullied() && Math.random() < this.parameters.RAND_VAL) {
                connected = true;
            }
        }

        if (connected) {
            var bo = this;
            this.legion.generateMessage("JoinAnswer", null, function (result) {
                result.destination = message.s;
                if (connection.isAlive())
                    connection.send(result);
                else {
                    bo.legion.messagingAPI.broadcastMessage(result);
                }
            });
        }

        if (connected)message.N--;
        message.TTL--;
        if (message.N > 0 && message.TTL > 0) {
            if (connection instanceof PeerConnection)
                this.legion.messagingAPI.propagateToN(message);
        }
    }
};

RandomGraphOverlay.prototype.onJoinAnswer = function (message, connection) {
    if (this.overlay.peers.contains(message.s)) {
        //No op.
    } else {
        this.legion.connectionManager.connectPeer(message.s);
    }
};

RandomGraphOverlay.prototype.removeBestPeer = function () {
    var bestPeer = this.getBestPeer();
    if (!bestPeer) {
        bestPeer = this.overlay.getPeers(1);
        if (bestPeer.length() > 0) {
            bestPeer = bestPeer[0];
        }
    }
    bestPeer.close();
};

RandomGraphOverlay.prototype.getBestPeer = function () {
    var best = null;
    var bestMeta = null;
    var peers = this.overlay.getPeers(this.overlay.peerCount());
    for (var i = 0; i < peers.length; i++) {
        if (!bestMeta) {
            bestMeta = peers[i].getMeta();
            best = peers[i];
        } else {
            if (this.isBetterMeta(peers[i].getMeta(), bestMeta)) {
                bestMeta = peers[i].getMeta();
                best = peers[i];
            }
        }
    }
    return best;
};

RandomGraphOverlay.prototype.isBetterMeta = function (m1, m2) {
    if (!m1) return false;
    if (!m2) return true;
    return m1.peers > m2.peers || m1.server < m2.server;
};

RandomGraphOverlay.prototype.sendP2PMeta = function () {
    var bo = this;
    this.legion.generateMessage("P2PMeta", null, function (result) {
        result.meta = {
            server: !bo.legion.bullyProtocol.amBullied(),
            peers: bo.legion.overlay.peerCount()
        };
        bo.legion.messagingAPI.broadcastMessage(result, [bo.legion.connectionManager.serverConnection]);
    });
};

RandomGraphOverlay.prototype.gotP2PMeta = function (message, connection) {
    connection.setMeta(message.meta);
};
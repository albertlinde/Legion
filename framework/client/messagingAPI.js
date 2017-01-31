//TODO: re-compress m.data on all messages.

function MessagingAPI(legion) {
    this.legion = legion;
    this.messagingProtocol = new this.legion.options.messagingProtocol(this, this.legion);

    this.callbacks = new ALMap();
    this.duplicates = new Duplicates();
}

/**
 * Handles message reception.
 * @param connection {PeerConnection,ServerConnection}
 * @param message {Object}
 */
MessagingAPI.prototype.onMessage = function (connection, message) {
    if (message.type != this.legion.bullyProtocol.handlers.bully.type) {
        if (!this.duplicates.contains(message.s, message.ID)) {
            this.duplicates.add(message.s, message.ID)
        } else {
            //console.log("Duplicate: (" + message.s + "," + message.ID + ")");
            return;
        }
    }
    if (message.destination)
        console.log(message.type + " from " + connection.remoteID + " by " + message.s + " to " + message.destination + ".");
    else
        console.log(message.type + " from " + connection.remoteID + " by " + message.s + ".");
    if (!message.destination || (message.destination && message.destination == this.legion.id)) {
        this.deliver(message, connection);
        if (message.p) {
            this.propagate(message, connection);
        }
    } else {
        this.propagate(message, connection);
    }
};


MessagingAPI.prototype.propagate = function (message, connection) {
    this.broadcastMessage(message, [connection.remoteID]);
};

/**
 * Used by legion to deliver received messages to Legion or the application.
 * @param message
 * @param connection
 */
MessagingAPI.prototype.deliver = function (message, connection) {
    if (this.callbacks.contains(message.type)) {
        this.callbacks.get(message.type)(message, connection);
    } else {
        console.warn("can't deliver: no handler defined", JSON.stringify(message));
    }
};

/**
 * Used by legion to broadcast messages.
 * @param message
 * @param except
 */
MessagingAPI.prototype.broadcastMessage = function (message, except) {
    if (message.compressed && message.data) {
        console.error(message);
    }
    this.messagingProtocol.broadcastMessage(message, except);
};

/**
 * Used by legion to unicast messages.
 * @param node
 * @param message
 * @param dontSetDestination {boolean} this is used to propagated over the network (false) or send directly(true)
 */
MessagingAPI.prototype.sendTo = function (node, message, dontSetDestination) {

    if (message.compressed && message.data && !dontSetDestination) {
        console.error(message);
    }
    //TODO: to fine grained control for applications at this level.
    this.messagingProtocol.sendTo(node, message, dontSetDestination);
};

/**
 * Propagates a message to a given amount of peers.
 * message.N is divided over all peers.
 * if the second argument is true, all peers get (at most) message.N = 1 and
 * the rest of N is sent to the signalling server.
 * If N is lower than the number of peers, message is sent to a subset of peers and never to the server.
 * @param message
 * @param toServerIfBully
 */
MessagingAPI.prototype.propagateToN = function (message, toServerIfBully) {

    if (message.compressed && message.data) {
        console.error(message);
    }

    //TODO: see this.sendTo
    if (!message.N) {
        console.error("NO N!");
        return;
    }
    var peers = this.legion.overlay.getPeers(message.N);

    var firstSet = 0;
    var secondSet = 0;
    var firstSetAmount = 0;
    var toServer = 0;

    if (toServerIfBully && !this.legion.bullyProtocol.amBullied()) {
        firstSet = 0;
        secondSet = 1;
        firstSetAmount = 0;
        toServer = message.N - peers.length;
    } else {
        var amount = Math.floor(message.N / peers.length);
        firstSet = amount + 1;
        secondSet = amount;
        firstSetAmount = Math.ceil(message.N % peers.length);
        toServer = message.N - peers.length;
    }

    var messageFirstSet = JSON.parse(JSON.stringify(message));
    messageFirstSet.N = firstSet;
    var messageSecondSet = JSON.parse(JSON.stringify(message));
    messageSecondSet.N = secondSet;

    for (var i = 0; i < firstSetAmount; i++) {
        if (peers[i].remoteID != message.s) {
            peers[i].send(messageFirstSet);
        } else {
            toServer++;
        }
    }
    for (var i = firstSetAmount; i < peers.length; i++) {
        if (peers[i].remoteID != message.s) {
            peers[i].send(messageSecondSet);
        } else {
            toServer++;
        }
    }

    if (toServer > 0 && toServerIfBully && !this.legion.bullyProtocol.amBullied()) {
        var messageServer = JSON.parse(JSON.stringify(message));
        messageServer.N = toServer;
        if (this.legion.connectionManager.serverConnection && this.legion.connectionManager.serverConnection.isAlive()) {
            this.legion.connectionManager.serverConnection.send(messageServer);
        }
    }
};

/**
 * Calls the current protocol broadcastMessage.
 * @param type {String}
 * @param data {Object}
 */
MessagingAPI.prototype.broadcast = function (type, data) {
    var mapi = this;
    //TODO: a way to internally sign messages would be nice
    this.legion.generateMessage(type, data, function (result) {
        result.p = 1;
        mapi.broadcastMessage(result);
        mapi.deliver({type: type, data: data});
    });
};

/**
 * The callback is called on each message, with two arguments.
 * The first parameter has content parsed.
 * The second can be used to propagate an (unchanged) content.
 * @param type {String}
 * @param callback {Function}
 */
MessagingAPI.prototype.setHandlerFor = function (type, callback) {
    this.callbacks.set(type, callback);
};
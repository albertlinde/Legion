var CRDT_LIB = {};

/**
 * @param legion
 * @constructor
 */
function ObjectStore(legion) {
    this.legion = legion;

    this.types = new ALMap();
    this.crdts = new ALMap();

    this.objectServer = null;

    this.peerSyncs = new ALMap();

    var os = this;
    this.handlers = {
        peerSync: {
            type: "OS:PS", callback: function (message) {
                var ps = os.peerSyncs.get(message.s);
                if (!ps) {
                    console.error("Got OS:PS for unknown peer.");
                } else {
                    ps.handleSync(message);
                }
            }
        },
        peerSyncAnswer: {
            type: "OS:PSA", callback: function (message) {
                var ps = os.peerSyncs.get(message.s);
                if (!ps) {
                    console.error("Got OS:PSA for unknown peer.");
                } else {
                    ps.handleSyncAnswer(message);
                }
            }
        },
        gotContentFromNetwork: {
            type: "OS:C", callback: function (message, connection) {
                os.gotContentFromNetwork(message, connection);
            }
        }
    };

    this.serverQueue = new DS_DLList();

    //TODO: re-define the options
    this.serverTimer = setInterval(function () {
        os.clearServerQueue();
    }, this.legion.options.objectOptions.serverInterval);

    this.peersQueue = new DS_DLList();

    this.peersTimer = setInterval(function () {
        os.clearPeersQueue();
    }, this.legion.options.objectOptions.peerInterval);

    var peers = this.legion.overlay.getPeers();
    if (peers.length > 0) {
        console.error("Already have peers!", peers.length);
    }


    this.legion.messagingAPI.setHandlerFor(this.handlers.peerSync.type, this.handlers.peerSync.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.peerSyncAnswer.type, this.handlers.peerSyncAnswer.callback);
    this.legion.messagingAPI.setHandlerFor(this.handlers.gotContentFromNetwork.type, this.handlers.gotContentFromNetwork.callback);

    //TODO: this should be parameterizable apart from signalling.
    this.legion.bullyProtocol.setOnBullyCallback(function (b) {
        os.bullyStatusChange();
    });

    this.defineCRDT(CRDT_LIB.DELTA_Counter);
    this.legion["Counter"] = CRDT_LIB.DELTA_Counter.type;
    this.defineCRDT(CRDT_LIB.DELTA_Set);
    this.legion["Set"] = CRDT_LIB.DELTA_Set.type;
    this.defineCRDT(CRDT_LIB.DELTA_Map);
    this.legion["Map"] = CRDT_LIB.DELTA_Map.type;
    this.defineCRDT(CRDT_LIB.DELTA_List);
    this.legion["List"] = CRDT_LIB.DELTA_List.type;

}

ObjectStore.prototype.bullyStatusChange = function () {
    if (this.legion.bullyProtocol.amBullied()) {
        this.disconnectFromObjectServer();
    }
};

ObjectStore.prototype.onMessageFromServer = function (message, connection) {
    console.log("Got " + message.type + " from " + this.objectServer.peerConnection.remoteID);
    switch (message.type) {
        case (this.handlers.peerSync.type):
            this.objectServer.handleSync(message, connection);
            return;
        case (this.handlers.peerSyncAnswer.type):
            this.objectServer.handleSyncAnswer(message, connection);
            return;
        case (this.handlers.gotContentFromNetwork.type):
            this.handlers.gotContentFromNetwork.callback(message, connection);
            return;
    }
    console.error("No typedef for: " + message);
};

ObjectStore.prototype.gotContentFromNetwork = function (message, connection) {
    for (var i = 0; i < message.data.length; i++) {
        //console.info("gcfn", message.data[i], connection);
        var objectID = message.data[i].objectID;
        var crdt = this.get(objectID);
        if (!crdt)
            crdt = this.getOrCreate(objectID, message.data[i].type);
        if (crdt) {
            //objectID: objectID,opID: {rID, oC},remoteArguments: remoteArguments,versionVector: versionVector,key: key
            //or
            //objectID: objectID, flattenedDelta: flattenedDelta, fromConnection: fromConnection
            if (message.data[i].opID) {
                if (crdt.versionVector.contains(message.data[i].opID.rID)) {
                    if (crdt.versionVector.get(message.data[i].opID.rID) >= message.data[i].opID.oC)
                        continue;
                }
                crdt.deltaOperationFromNetwork(message.data[i], connection);
            } else {
                var ret = crdt.deltaFromNetwork(message.data[i].fd, connection);
            }
        } else {
            console.error("Got changes for no crdt", message)
        }
    }
};

ObjectStore.prototype.disconnectFromObjectServer = function () {
    if (this.objectServer) {
        this.objectServer.close();
    }
};

ObjectStore.prototype.connectToObjectServer = function () {
    //TODO: the if is not enough. concurrent calls (see signalling server)
    if (this.legion.options.objectServerConnection.type == "NONE") {
        return;
    }
    if (!this.objectServer && this.legion.options.objectServerConnection)
        new this.legion.options.objectServerConnection.type(this.legion.options.objectServerConnection.server, this, this.legion);
};

ObjectStore.prototype.clearServerQueue = function () {
    if (this.legion.options.objectServerConnection.type == "NONE") {
        //console.log("Objects server is not to be used.");
        this.serverQueue.clear();
        return;
    }
    //TODO: re-define what happens in all cases.
    if (!this.legion.bullyProtocol.amBullied()) {
        if (!this.objectServer) {
            //console.log("Don't have a connection to objects server. Will try again soon.");
            this.connectToObjectServer();
            return;
        }
    } else {
        if (this.serverQueue.size() > 0) {
            //console.log("Clearing server queue. Am bullied.");
            this.serverQueue.clear();
        }
        this.disconnectFromObjectServer();
        return;
    }

    if (this.serverQueue.size() > 0) {
        //console.log("Messages in server queue: " + this.serverQueue.size());
        var pop = this.serverQueue.removeFirst();
        var opList = [];
        while (pop) {
            if (pop.fromConnection) {
                if (pop.fromConnection instanceof this.legion.options.objectServerConnection.type) {
                    pop = this.serverQueue.removeFirst();
                    continue;
                } else {
                    delete pop.fromConnection;
                }
            }
            opList.push(pop);
            pop = this.serverQueue.removeFirst();
        }

        if (opList.length > 0) {
            var os = this;
            this.legion.generateMessage(this.handlers.gotContentFromNetwork.type, opList, function (result) {
                os.objectServer.send(result);
            });
        }
    }
};

ObjectStore.prototype.clearPeersQueue = function () {
    if (this.peersQueue.size() > 0) {
        //console.log("Messages in peers queue: " + this.peersQueue.size());
        var pop = this.peersQueue.removeFirst();
        var opList = [];
        var lastFrom = null;
        while (pop) {
            if (
                (lastFrom == null && pop.fromConnection != null) ||
                (pop.fromConnection && lastFrom == null) ||
                (pop.fromConnection != null && pop.fromConnection.remoteID != lastFrom)) {
                if (opList.length > 0) {
                    (function (except, os, opList) {
                        os.legion.generateMessage(os.handlers.gotContentFromNetwork.type, opList, function (result) {
                            if (except != null)
                                os.legion.messagingAPI.broadcastMessage(result, [os.legion.connectionManager.serverConnection, except]);
                            else
                                os.legion.messagingAPI.broadcastMessage(result, [os.legion.connectionManager.serverConnection]);
                        });
                    })(lastFrom, this, opList);
                }
                opList = [];

                if (pop.fromConnection == null) {
                    lastFrom = null;
                } else {
                    if (this.legion.options.objectServerConnection.type != "NONE" && pop.fromConnection instanceof this.legion.options.objectServerConnection.type) {
                        lastFrom = null;
                    } else {
                        lastFrom = pop.fromConnection.remoteID;
                    }
                }
            } else {
                //same as last from, change nothing.
            }
            delete pop.fromConnection;
            opList.push(pop);
            pop = this.peersQueue.removeFirst();
        }
        (function (except, os, opList) {
            os.legion.generateMessage(os.handlers.gotContentFromNetwork.type, opList, function (result) {
                if (except != null)
                    os.legion.messagingAPI.broadcastMessage(result, [os.legion.connectionManager.serverConnection, except]);
                else
                    os.legion.messagingAPI.broadcastMessage(result, [os.legion.connectionManager.serverConnection]);
            });
        })(lastFrom, this, opList);
    }
};

/**
 * Defines a CRDT that can later be instantiated.
 * @param crdt
 */
ObjectStore.prototype.defineCRDT = function (crdt) {
    if (this.types.contains(crdt.type)) {
        console.error("Can't redefine existing CRDT.", crdt);
    } else {
        this.types.set(crdt.type, crdt);
    }
};

/**
 * Creates or obtains a CRDT.
 * @param objectID
 * @param type
 * @returns {Object}
 */
ObjectStore.prototype.getOrCreate = function (objectID, type) {
    if (!this.types.contains(type)) {
        console.error("No typedef found for CRDT.", type);
    } else {
        if (this.crdts.contains(objectID)) {
            return this.crdts.get(objectID);
        } else {
            var crdt = this.types.get(type);
            console.log("Instantiating new CRDT: <" + objectID + ", " + type + ">");
            var instance = new CRDT(objectID, crdt, this);
            this.crdts.set(objectID, instance);
            return instance;
        }
    }
};

ObjectStore.prototype.get = function (objectID) {
    return this.crdts.get(objectID);
};

/**
 *
 * @param objectID {String}
 * @param opID {Object}
 * @param remoteArguments {Object}
 * @param versionVector {Array} UNUSED!
 * @param key {String}
 * @param fromConnection
 */
ObjectStore.prototype.propagate = function (objectID, opID, remoteArguments, versionVector, key, fromConnection, type) {
    var queuedOP = {
        objectID: objectID,
        opID: opID,
        arg: remoteArguments,
        key: key,
        fromConnection: fromConnection,
        type: type
    };
    this.peersQueue.addLast(queuedOP);

    if (this.objectServer) {
        queuedOP = {
            objectID: objectID,
            opID: opID,
            arg: remoteArguments,
            key: key,
            fromConnection: fromConnection,
            type: type
        };
        this.serverQueue.addLast(queuedOP);
    }
};

ObjectStore.prototype.propagateFlattenedDelta = function (objectID, flattenedDelta, fromConnection, type) {
    var queuedDelta = {
        objectID: objectID,
        fd: flattenedDelta,
        fromConnection: fromConnection,
        type: type
    };

    this.peersQueue.addLast(queuedDelta);
    if (this.objectServer) {
        queuedDelta = {
            objectID: objectID,
            fd: flattenedDelta,
            fromConnection: fromConnection,
            type: type
        };
        this.serverQueue.addLast(queuedDelta);
    }
};


/**
 * Added objects connection.
 * @param serverConnection
 */
ObjectStore.prototype.onServerDisconnect = function (serverConnection) {
    this.objectServer = null;
    this.serverQueue.clear();
};

/**
 * Objects connection dropped.
 * @param serverConnection
 */
ObjectStore.prototype.onServerConnection = function (serverConnection) {
    this.objectServer = new PeerSync(this.legion, this, serverConnection);
    this.objectServer.sync();
};

/**
 * Overlay added a peer.
 * @param peerConnection
 */
ObjectStore.prototype.onClientConnection = function (peerConnection) {
    var p = new PeerSync(this.legion, this, peerConnection);
    this.peerSyncs.set(peerConnection.remoteID, p);
    p.sync();
};

/**
 * A peer dropped the connection.
 * @param peerConnection
 */
ObjectStore.prototype.onClientDisconnect = function (peerConnection) {
    var p = this.peerSyncs.get(peerConnection.remoteID);
    if (p) {
        this.peerSyncs.delete(peerConnection.remoteID);
        p.finalize();
    }
};

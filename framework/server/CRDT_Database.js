if (typeof exports != "undefined") {
    exports.CRDT_Database = CRDT_Database;

    ALMap = require('./../shared/ALMap.js');
    ALMap = ALMap.ALMap;
    DS_DLList = require('./../shared/dataStructures/DS_DLList.js');
    DS_DLList = DS_DLList.DS_DLList;
    util = require('util');
    Compressor = require('./../shared/Compressor.js');
    objectsDebug = false;
}

function CRDT_Database(messaging, peerSyncs) {
    var cb = this;
    //TODO: the non-constant constants must be put somewhere neat.
    this.peerSendInterval = 3000;
    this.peersQueue = new DS_DLList();

    this.messagingAPI = messaging;
    this.peerSyncs = peerSyncs;

    this.crdts = new ALMap();
    this.types = new ALMap();

    this.saveTime = 15000;

    this.messageCount = Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, 10)));
    //TODO: hardcoded ID!
    this.id = "localhost:8004";

    //TODO: this must be optional/definable
    //TODO: if there is a savetodisk there must be a load from disk?
    setInterval(function () {
        cb.saveToDisk()
    }, this.saveTime);
    setInterval(function () {
        cb.clearPeersQueue();

    }, this.peerSendInterval);

    //Following code served as a tester for client example:set.html
    /*
     var n = 0;
     setInterval(function () {
     try {
     cb.getCRDT("set_1_state").add("s:" + ++n);
     cb.getCRDT("set_2_operations").add("s:" + ++n)
     } catch (e) {
     console.log("No data yet.");
     }
     }, 2000);
     */
}
CRDT_Database.prototype.clearPeersQueue = function () {
    if (this.peersQueue.size() > 0) {
        console.log("Messages in peers queue: " + this.peersQueue.size());
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
                        os.generateMessage(os.handlers.gotContentFromNetwork.type, opList, function (result) {
                            if (except != null)
                                os.messagingAPI.broadcastMessage(result, [except]);
                            else
                                os.messagingAPI.broadcastMessage(result, []);
                        });
                    })(lastFrom, this, opList);
                }
                opList = [];

                if (pop.fromConnection == null) {
                    lastFrom = null;
                } else {
                    lastFrom = pop.fromConnection.remoteID;
                }
            } else {
                //same as last from, change nothing.
            }
            delete pop.fromConnection;
            opList.push(pop);
            pop = this.peersQueue.removeFirst();
        }
        (function (except, os, opList) {
            os.generateMessage(os.handlers.gotContentFromNetwork.type, opList, function (result) {
                if (except != null)
                    os.messagingAPI.broadcastMessage(result, [except]);
                else
                    os.messagingAPI.broadcastMessage(result, []);
            });
        })(lastFrom, this, opList);
    }
};

CRDT_Database.prototype.saveToDisk = function () {
    console.log("(not) saving to disk.");
    var keys = this.crdts.keys();
    for (var i = 0; i < keys.length; i++) {
        console.log("    KEY: " + keys[i] + " VALUE: " + JSON.stringify(this.get(keys[i]).getValue()) + " VV: " + JSON.stringify(this.get(keys[i]).versionVector.toJSONString()));
    }
};

/**
 *
 * @param objectID {String}
 * @param operationID {Object}
 * @param remoteArguments {Object}
 * @param versionVector {Array}  UNUSED!
 * @param key {String}
 * @param fromConnection
 */
CRDT_Database.prototype.propagate = function (objectID, operationID, remoteArguments, versionVector, key, fromConnection, type) {
    var queuedOP = {
        objectID: objectID,
        opID: operationID,
        arg: remoteArguments,
        key: key,
        fromConnection: fromConnection,
        type: type
    };

    this.peersQueue.addLast(queuedOP);
};

CRDT_Database.prototype.propagateFlattenedDelta = function (objectID, flattenedDelta, fromConnection, type) {
    var queuedDelta = {
        objectID: objectID,
        fd: flattenedDelta,
        fromConnection: fromConnection,
        type: type
    };
    this.peersQueue.addLast(queuedDelta);
};

CRDT_Database.prototype.defineCRDT = function (crdt) {
    if (this.types.contains(crdt.type)) {
        util.error("Can't redefine existing CRDT.", crdt);
    } else {
        this.types.set(crdt.type, crdt);
        util.log("CRDT defined: " + crdt.type);
    }
};

CRDT_Database.prototype.getOrCreate = function (objectID, type) {
    console.log("getOrCreate: " + objectID);
    var crdt = this.crdts.get(objectID);
    if (crdt)
        return crdt;

    console.log("getOrCreate type: " + type);
    if (!this.types.contains(type)) {
        util.error("No typedef found for CRDT.", type);
    } else {
        var crdtDef = this.types.get(type);
        var instance = new CRDT(objectID, crdtDef, this);
        this.crdts.set(objectID, instance);
        console.log("getOrCreate done.");
        return instance;
    }
};

CRDT_Database.prototype.get = function (objectID) {
    return this.crdts.get(objectID);
};

CRDT_Database.prototype.getIdentifiers = function () {
    return this.crdts.keys();
};

CRDT_Database.prototype.gotContentFromNetwork = function (message, connection) {

    for (var i = 0; i < message.data.length; i++) {
        //console.info("gcfn", message.data[i]);
        var objectID = message.data[i].objectID;
        var crdt = this.get(objectID);
        if (!crdt)
            crdt = this.getOrCreate(objectID, message.data[i].type);
        if (crdt) {
            if (message.data[i].opID) {
                if (crdt.versionVector.contains(message.data[i].opID.rID)) {
                    if (crdt.versionVector.get(message.data[i].opID.rID) >= message.data[i].opID.oC)
                        continue;
                }
                crdt.deltaOperationFromNetwork(message.data[i], connection);
            } else {
                crdt.deltaFromNetwork(message.data[i].fd, connection);
            }
            //TODO: see (copy) client.objectstore
        } else {
            console.error("Got op for no crdt", message)
        }
    }
};

CRDT_Database.prototype.generateMessage = function (type, data, callback) {
    if (!type) {
        util.error("No type for message.");
        return;
    }
    var message = {
        type: type,
        s: this.id,
        ID: ++this.messageCount
    };
    if (data) {
        message.data = data;
    }
    callback(message);
};

var PS_TIMEOUT = 13 * 1000;
/**
 * How peer sync works:
 *
 * Keep new messages in buffer.
 *
 * Send <oid, vv, type, meta> of each object.
 *
 * For each <oid, vv, type, meta> received:
 *   Add <oid, Object(oid).getDelta(vv,meta)> to message.
 * Then Send back message.
 *
 * On Message back: apply updates, then clear buffer.
 *
 */

/**
 *
 * @param legion {Legion}
 * @param objectStore {ObjectStore}
 * @param peerConnection {PeerConnection}
 * @constructor
 */
function PeerSync(legion, objectStore, peerConnection) {
    //console.log("New peerSync from " + legion.id + " to " + peerConnection.remoteID);
    this.legion = legion;
    this.objectStore = objectStore;
    this.peerConnection = peerConnection;

    /**
     * True when syncing is done.
     * @type {boolean}
     */
    this.isSynced = false;
    this.sentS = false;
    this.sentSA = false;

    /**
     * Before receiving the vv nothing should be sent to the other node,
     * when receiving the vv the Delta sent will contain the necessary updates.
     * Between receiving the VVs and sending the Delta, no operations are executed (single thread).
     * After sending the Delta, the queue is no longer used.
     * Therefore this is not needed, at all.
     * Contains updates to be sent after sync.
     * @type {DS_DLList}
     */
    this.queueAfterSync = new DS_DLList();

    var ps = this;
    this.psTimeout = setTimeout(function () {
        console.error("No PeerSync in time.", ps.legion.id, ps.peerConnection.remoteID);
    }, PS_TIMEOUT);
}

PeerSync.prototype.send = function (message) {
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.isSynced && this.queueAfterSync.size() == 0) {
        this.peerConnection.send(message);
    } else {
        if (this.isSynced) {
            console.error("Peer is in sync but still appending.");
        }
        this.queueAfterSync.addLast(message);
        //console.warn("Attempt to send queue before sync.", this.isSynced, this.queueAfterSync.size());
    }
};

/**
 * Clears the queue, sending all messages to the peer.
 */
PeerSync.prototype.clearQueue = function () {
    var ps = this;
    //console.log("Clearing queue to: " + this.peerConnection.remoteID + ". Size of queue: " + (this.queueAfterSync.size() + 1));
    this.legion.generateMessage("Fake", {fake: "data"}, function (result) {
        var pop = ps.queueAfterSync.removeFirst();
        while (typeof pop != "undefined") {
            ps.peerConnection.send(pop);
            pop = ps.queueAfterSync.removeFirst();
        }
        ps.isSynced = true;
    });

};

/**
 * Receives from remote peer a message generated by PeerSync.sync.
 * @param message {...{data: []}}
 */
PeerSync.prototype.handleSyncAnswer = function (message) {
    //console.log("HSA");
    var deltas = message.data.deltas;

    for (var j = 0; j < deltas.length; j++) {
        var crdt = this.objectStore.getOrCreate(deltas[j].id, deltas[j].type);
        crdt.deltaFromNetwork(deltas[j], this.peerConnection);
    }

    this.clearQueue();
    clearTimeout(this.psTimeout);
    if (this.objectStore.doneAPeerSync)
        this.objectStore.doneAPeerSync(this.peerConnection instanceof ObjectServerConnection);
};

/**
 * Receives from remote peer a message generated by PeerSync.sync.
 * @param message {...{data: []}}
 */
PeerSync.prototype.handleSync = function (message) {
    var objects = message.data;

    var answer = {};
    answer.deltas = [];

    for (var i = 0; i < objects.length; i++) {
        var crdt = this.objectStore.getOrCreate(objects[i].id, objects[i].type);
        var toSend = crdt.getDelta(objects[i].vv, objects[i].m);
        if (toSend != null) {
            answer.deltas.push({
                id: crdt.objectID,
                d: toSend,
                type: crdt.crdt.type,
                vv: crdt.versionVector.toJSONString(),
                m: crdt.getMeta()
            });
        }
    }

    var mine = this.objectStore.crdts.keys();
    for (var i = 0; i < mine.length; i++) {
        var found = false;
        for (var h = 0; h < objects.length; h++) {
            if (objects[h].id == mine[i]) {
                found = true;
                break;
            }
        }
        if (!found) {
            var crdt = this.objectStore.get(mine[i]);
            var toSend = crdt.getDelta([], {});
            if (toSend != null) {
                answer.deltas.push({
                    id: crdt.objectID,
                    d: toSend,
                    type: crdt.crdt.type,
                    vv: crdt.versionVector.toJSONString(),
                    m: crdt.getMeta()
                });
            } else {
                console.warn("No data to send for crdt: " + mine[i]);
            }
        }
    }

    var ps = this;

    this.legion.generateMessage(this.objectStore.handlers.peerSyncAnswer.type, answer, function (result) {
        if (ps.peerConnection) {
            result.destination = ps.peerConnection.remoteID;
            ps.peerConnection.send(JSON.stringify(result));
            ps.sentSA = true;
        }
    });
};

PeerSync.prototype.sync = function () {

    var ps = this;
    var objects = [];

    var localKeys = this.objectStore.crdts.keys();
    for (var i = 0; i < localKeys.length; i++) {
        var crdt = this.objectStore.get(localKeys[i]);
        objects.push({
            id: crdt.objectID,
            vv: crdt.versionVector.toJSONString(),
            type: crdt.crdt.type,
            m: crdt.getMeta()
        });
    }
    this.legion.generateMessage(this.objectStore.handlers.peerSync.type, objects, function (result) {
        result.destination = ps.peerConnection.remoteID;
        try {
            ps.peerConnection.send(JSON.stringify(result));
            ps.sentS = true;
        } catch (e) {
            console.error(result);
            console.error(JSON.stringify(result));
            ps.close();
        }
    });
};

if (typeof exports != "undefined") {
    exports.PeerSync = PeerSync;

    VersionVector = require('./VersionVector.js');
    VersionVector = VersionVector.VersionVector;
    DS_DLList = require('./dataStructures/DS_DLList.js');
    DS_DLList = DS_DLList.DS_DLList;
}


PeerSync.prototype.close = function () {
    this.peerConnection.close();
    this.finalize();
};

PeerSync.prototype.finalize = function () {
    this.isSynced = false;
    this.peerConnection = null;
    this.queueAfterSync.clear();
    this.queueAfterSync = null;
    clearTimeout(this.psTimeout);
};
//var operationID = {replicaID: c.objectStore.legion.id, operationCount: ++c.localOP};
//has been changed to
//var opID = {rID: c.objectStore.legion.id, oC: ++c.localOP};


if (typeof exports != "undefined") {
    CRDT_Database = true;
    exports.CRDT = CRDT;
}


/**
 * CRDT instance as encapsulation.
 * @param objectID
 * @param crdt
 * //TODO: {ObjectStore | CRDT_Database} -> there should be well defined interfaces.
 * @param objectStore {ObjectStore | CRDT_Database}
 * @constructor
 */
function CRDT(objectID, crdt, objectStore) {
    this.objectStore = objectStore;
    this.objectID = objectID;
    this.crdt = crdt;

    /**
     * Create the default value (empty object).
     */
    this.state = {};
    var stateKeys = Object.keys(this.crdt.crdt.base_value.state);
    for (var i = 0; i < stateKeys.length; i++) {
        if (typeof this.crdt.crdt.base_value.state[stateKeys[i]] == "function") {
            this.state[stateKeys[i]] = new this.crdt.crdt.base_value.state[stateKeys[i]]();
        } else {
            this.state[stateKeys[i]] = JSON.parse(JSON.stringify(this.crdt.crdt.base_value.state[stateKeys[i]]));
        }
    }

    /**
     * Returns the CRDT value (application use-able).
     * @type {Function}
     */
    this.getValue = crdt.crdt.getValue;

    /**
     * Assigns local operations.
     */
    var keys = Object.keys(this.crdt.crdt.operations);
    var c = this;

    this.garbageCollect = crdt.crdt.garbageCollect;
    this.getDelta = crdt.crdt.getDelta;
    this.applyDelta = crdt.crdt.applyDelta;
    this.getMeta = crdt.crdt.getMeta;

    this.versionVector = new VersionVector();

    this.meta = {};

    this.locals = [];
    this.remotes = [];

    this.localOP = 0;

    for (var j = 0; j < keys.length; j++) {
        (function (key) {
            c.locals[key] = c.crdt.crdt.operations[key].local;
            c.remotes[key] = c.crdt.crdt.operations[key].remote;

            c[key] = function () {
                var opID = {rID: c.objectStore.legion.id, oC: ++c.localOP};
                var args = [];
                for (var arg_i = 0; arg_i < arguments.length; arg_i++) {
                    args.push(arguments[arg_i]);
                }
                args.push(opID);

                var ret = c.locals[key].apply(c, args);

                if (ret.toNetwork) {

                    var remote_ret = c.remotes[key].apply(c, [ret.toNetwork]);
                    c.objectStore.propagate(c.objectID, opID, ret.toNetwork, c.versionVector.toJSONString(), key, undefined, c.crdt.type);

                    //console.info(c.versionVector.toJSONString());

                    c.addOpToCurrentVersionVector(opID);

                    //console.info(c.versionVector.toJSONString());

                    (function () {
                        if (c.callback)
                            c.callback(remote_ret, {local: true});
                    })();

                } else {
                    //No version change.
                    --c.localOP;
                }
                if (ret.toInterface != null) {
                    return ret.toInterface;
                }
            };
        })(keys[j]);
    }

    /**
     * Contains a callback for object updates (user defined).
     * The first argument of the callback will be per object defined.
     * The second argument is a JSObject {local: bool}.
     * The local value is true when change happened due to local operations.
     * False when due to a remote operation.
     * @type {Function|null}
     */
    this.callback = null;
}

CRDT.prototype.addOpToCurrentVersionVector = function (opID) {
    this.versionVector.set(opID.rID, opID.oC);
};

/**
 * Return the internal state of the object.
 * @returns {Object}
 */
CRDT.prototype.getState = function () {
    return this.state;
};

/**
 * Sets a callback for updates on CRDT state.
 * @param callback {Function}
 */
CRDT.prototype.setOnStateChange = function (callback) {
    this.callback = callback;
};

CRDT.prototype.deltaOperationFromNetwork = function (deltaOperation, original, connection) {
    var remote_ret = this.remotes[deltaOperation.key].apply(this, [deltaOperation.arg]);
    this.addOpToCurrentVersionVector(deltaOperation.opID);
    this.objectStore.propagate(this.objectID, deltaOperation.opID, deltaOperation.arg, deltaOperation.versionVector, deltaOperation.key, connection, this.crdt.type);
    if (this.callback && remote_ret) {
        this.callback(remote_ret, {local: false});
    }
};

/**
 *
 * @param delta
 * @param connection
 */
CRDT.prototype.deltaFromNetwork = function (delta, connection) {
    var ret = {
        hadNew: false
    };

    var applied = this.applyDelta(delta.d, delta.vv, delta.m);
    if (applied.flattened) {
        ret.hadNew = true;
    }
    if (applied.flattened) {
        var vv_keys = Object.keys(delta.vv);
        for (var i = 0; i < vv_keys.length; i++) {
            var key = vv_keys[i];
            if (this.versionVector.contains(key))
                this.versionVector.set(key, Math.max(delta.vv[key], this.versionVector.get(key)));
            else
                this.versionVector.set(key, delta.vv[key]);
        }

        var flattened = {d: applied.flattened.delta, vv: applied.flattened.vv, m: applied.flattened.m};
        this.objectStore.propagateFlattenedDelta(this.objectID, flattened, connection, this.crdt.type);
    }
    if (this.callback && applied.change) {
        this.callback(applied.change, {local: false});
    }
    return ret;
};


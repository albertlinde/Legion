function GapiInterfaceHandler(objects, map) {
    this.objects = objects;
    this.map = map;
    this.handlers = new ALMap();
}

GapiInterfaceHandler.prototype.getModel = function () {
    return this;
};

GapiInterfaceHandler.prototype.getRoot = function () {
    return this;
};

GapiInterfaceHandler.prototype.get = function (id) {
    if (!this.map.get(id) || !this.objects[this.map.get(id)]) {
        console.warn("ID doesn't exist: " + id);
        return;
    }
    if (!this.handlers[id])
        this.handlers[id] = new GapiObjectHandler(this.objects[this.map.get(id)], this);
    return this.handlers[id];
};

function GapiObjectHandler(object, interfaceHandler) {
    this.object = object;
    this.interfaceHandler = interfaceHandler;
    this.callbacks = [];
}

//Map
GapiObjectHandler.prototype.set = function (key, value) {
    if (value instanceof GapiObjectHandler)
        this.object.set(key, {ref: value.object.objectID});
    else
        this.object.set(key, JSON.stringify(value));
};

GapiObjectHandler.prototype.get = function (key) {
    if (this.object.crdt.type == "M") {
        var ret = this.object.get(key);
        if (ret.ref) {
            return this.interfaceHandler.get(ret.ref);
        } else
            try {
                return JSON.parse(ret[0]);
            } catch (e) {
                return ret[0];
            }
    } else {
        //LIST
        var ret = this.object.get(key);
        if (ret.ref) {
            return this.interfaceHandler.get(ret.ref);
        } else {
            return JSON.parse(ret);
        }
    }
};

GapiObjectHandler.prototype.keys = function () {
    return this.object.keys();
};

GapiObjectHandler.prototype.values = function () {
    return this.object.values();
};

GapiObjectHandler.prototype.items = function () {
    var ret = [];
    var keys = this.object.keys();
    for (var i = 0; i < keys.length; i++) {
        try {
            ret.push(keys[i], JSON.parse(this.object.get(keys[i])));
        } catch (e) {
            ret.push(keys[i], this.object.get(keys[i]));

        }
    }
    return ret;
};

GapiObjectHandler.prototype.has = function (key) {
    return this.object.contains(key);
};

GapiObjectHandler.prototype.delete = function (key) {
    this.object.delete(key);
};

//List
GapiObjectHandler.prototype.remove = function (pos) {
    this.object.remove(pos);
};

GapiObjectHandler.prototype.insert = function (pos, val) {
    if (val instanceof GapiObjectHandler)
        this.object.add(pos, {ref: this.object.objectID});
    else
        this.object.add(pos, val);
};

GapiObjectHandler.prototype.callback = function (values) {
    for (var i = 0; i < this.callbacks.length; i++) {
        this.callbacks[i](values);
    }
};

GapiObjectHandler.prototype.pushAll = function (values) {
    this.object.addAll(values);
};

GapiObjectHandler.prototype.push = function (val) {
    if (val instanceof GapiObjectHandler)
        this.object.add(this.object.size(), {ref: this.object.objectID});
    else
        this.object.add(this.object.size(), val);
};

GapiObjectHandler.prototype.asArray = function () {
    var ret = [];
    var temp = this.object.getValue();
    for (var i = 0; i < temp.length; i++) {
        try {
            ret.push(JSON.parse(temp[i]));
        }
        catch (e) {
            ret.push(temp[i]);

        }
    }
    return ret;
};

GapiObjectHandler.prototype.addEventListener = function (event, callback) {
    this.callbacks.push(callback);
    var goi = this;
    if (!gapi.drive) {
        gapi.drive = {
            realtime: {
                EventType: {
                    VALUE_CHANGED: "1",
                    VALUES_SET: "2"
                }
            }
        }
    }
    switch (event) {
        case gapi.drive.realtime.EventType.TEXT_INSERTED:
            this.object.setOnStateChange(function () {
                goi.callback();
            });
            break;
        case gapi.drive.realtime.EventType.TEXT_DELETED:
            this.object.setOnStateChange(function () {
                goi.callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUES_ADDED:
            this.object.setOnStateChange(function () {
                goi.callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUES_REMOVED:
            this.object.setOnStateChange(function () {
                goi.callback();
            });
            break;
        case gapi.drive.realtime.EventType.VALUES_SET:
            this.object.setOnStateChange(function (crdt_answer) {
                var ret = {
                    index: crdt_answer.pos,
                    newValues: [crdt_answer.added],
                    oldValues: [JSON.parse(crdt_answer.removed)]
                };
                goi.callback(ret);
            });
            break;
        case gapi.drive.realtime.EventType.VALUE_CHANGED:
            this.object.setOnStateChange(function (updates, meta) {
                var ret = {};

                console.log("VALUE_CHANGED: " + JSON.stringify(updates) + " " + JSON.stringify(meta));

                if (updates.set) {
                    ret.property = updates.set.key;
                    ret.newValue = JSON.parse(updates.set.value);
                }

                goi.callback(ret);
            });
            break;
    }
};

GapiObjectHandler.prototype.getId = function () {
    return {type: 'b2b', id: this.object.objectID};
};
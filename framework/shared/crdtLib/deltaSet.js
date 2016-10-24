if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

//TODO: 1:when removing elements remove them from the <adds> Map. 2: deltas ignore unfound adds(they were removed).

var delta_set = {
    type: "DELTA_Set",
    crdt: {
        base_value: {
            state: {
                elements: ALMap,
                adds: ALMap,
                removes: ALMap,
                newElements: Number,
                oldElements: Number,
                added: ALMap,
                removed: ALMap
            }
        },
        getValue: function () {
            return this.state.elements.keys();
        },
        operations: {
            contains: {
                local: function (element) {
                    var toInterface = false;
                    if (this.state.elements.contains(element)) {
                        toInterface = true;
                    }
                    return {
                        toInterface: toInterface,
                        toNetwork: null
                    };

                }, remote: function () {
                    //never called.
                }
            },
            asArray: {
                local: function () {
                    return {
                        toInterface: this.state.elements.keys(),
                        toNetwork: null
                    };

                }, remote: function () {
                    //never called.
                }
            },
            add: {
                local: function (element, metadata) {
                    if (!this.state.elements.contains(element)) {
                        return {
                            toInterface: null,
                            toNetwork: {
                                element: element,
                                id: metadata.replicaID,
                                op: ++this.state.newElements
                            }
                        };

                    } else {
                        //element exists.
                        return {
                            toInterface: null,
                            toNetwork: null
                        };
                    }
                }, remote: function (data) {
                    var added = false;
                    var pairs = this.state.elements.get(data.element);
                    if (!pairs) {
                        pairs = new ALMap();
                        this.state.elements.set(data.element, pairs);
                        added = true;
                    }

                    pairs.set(data.id, data.op);

                    if (!this.state.adds.contains(data.id)) {
                        this.state.adds.set(data.id, new ALMap());
                    }
                    this.state.adds.get(data.id).set(data.op, data.element);

                    this.state.added.set(data.id, data.op);

                    if (added)
                        return {added: data.element};
                    else
                        return null;
                }
            },
            remove: {
                local: function (element, metadata) {
                    if (!this.state.elements.contains(element)) {
                        return {
                            toInterface: null,
                            toNetwork: null
                        };
                    } else {
                        //element exists.
                        var pairs = this.state.elements.get(element);
                        return {
                            toInterface: null,
                            toNetwork: {
                                element: element,
                                pairs: pairs.toArray(),
                                id: metadata.replicaID,
                                op: ++this.state.oldElements
                            }
                        };
                    }
                }, remote: function (data) {
                    var removed = false;
                    var pairs = this.state.elements.get(data.element);
                    if (pairs) {
                        var receivedRemoves = data.pairs;
                        for (var i = 0; i < receivedRemoves.length; i++) {
                            var k = receivedRemoves[i][0];
                            var v = receivedRemoves[i][1];
                            if (pairs.get(k) <= v) {
                                pairs.delete(k);
                            }
                        }
                        if (pairs.size() == 0) {
                            this.state.elements.delete(data.element);
                            removed = true;
                        }
                    }


                    if (!this.state.removes.contains(data.id)) {
                        this.state.removes.set(data.id, new ALMap());
                    }
                    this.state.removes.get(data.id).set(data.op, [data.element, data.pairs]);
                    this.state.removed.set(data.id, data.op);

                    if (removed)
                        return {removed: data.element};
                    else
                        return null;
                }
            }
        },
        getDelta: function (vv, meta) {
            console.info("START getDelta Set");
            console.info(meta);
            var ret = {adds: [], removes: []};

            var hisAdds = meta.added;
            var hisRemoves = meta.removed;

            for (var i = 0; i < hisAdds.length; i++) {
                var k = hisAdds[i][0];
                var v = hisAdds[i][1];
                if (this.state.added.get(k) > v) {
                    for (var ai = v + 1; ai <= this.state.added.get(k); ai++) {
                        ret.adds.push([k, ai, this.state.adds.get(k).get(ai)]);
                    }
                }
            }

            var myAdds = this.state.added.keys();
            for (var j = 0; j < myAdds.length; j++) {
                var found = false;
                for (var i = 0; i < hisAdds.length; i++) {
                    if (myAdds[j] == hisAdds[i][0]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (var ai = 1; ai <= this.state.added.get(myAdds[j]); ai++) {
                        ret.adds.push([myAdds[j], ai, this.state.adds.get(myAdds[j]).get(ai)]);
                    }
                }
            }


            for (var j = 0; j < hisRemoves.length; j++) {
                var k = hisRemoves[j][0];
                var v = hisRemoves[j][1];
                if (this.state.removed.get(k) > v) {
                    for (var ri = v + 1; ri <= this.state.removed.get(k); ri++) {
                        ret.removes.push([k, ri, this.state.removes.get(k).get(ri)]);
                    }
                }
            }

            var myRemoves = this.state.removed.keys();
            for (var j = 0; j < myRemoves.length; j++) {
                var found = false;
                for (var i = 0; i < hisRemoves.length; i++) {
                    if (myRemoves[j] == hisRemoves[i][0]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (var ai = 1; ai <= this.state.removed.get(myRemoves[j]); ai++) {
                        ret.removes.push([myRemoves[j], ai, this.state.removes.get(myRemoves[j]).get(ai)]);
                    }
                }
            }


            console.info(ret);
            console.info("END getDelta Set");

            if (ret.removes.length > 0 || ret.adds.length > 0) {
                return ret;
            } else {
                return null;
            }

        },
        applyDelta: function (delta, vv, meta) {
            console.info("Start APPLY Set")
            console.info(delta)
            var has = false;
            var change = {added: [], removed: []};
            for (var a = 0; a < delta.adds.length; a++) {
                var replicaID = delta.adds[a][0];
                var operationID = delta.adds[a][1];
                var element = delta.adds[a][2];


                if (this.state.adds.get(replicaID) && this.state.adds.get(replicaID).get(operationID)) {
                    console.info("Already had op.");
                    delta.adds = delta.adds.slice(0, a).concat(delta.adds.slice(a + 1, delta.adds.length));
                } else {
                    console.info("New op.");
                    has = true;
                    var pairs = this.state.elements.get(element);
                    if (!pairs) {
                        pairs = new ALMap();
                        this.state.elements.set(element, pairs);
                        change.added.push(element);
                    }
                    pairs.set(replicaID, operationID);
                    if (!this.state.adds.contains(replicaID)) {
                        this.state.adds.set(replicaID, new ALMap());
                    }
                    this.state.adds.get(replicaID).set(operationID, element);
                    this.state.added.set(replicaID, operationID);
                }
            }
            for (var r = 0; r < delta.removes.length; r++) {
                var rReplicaID = delta.removes[r][0];
                var rOperationID = delta.removes[r][1];
                var rElement = delta.removes[r][2][0];
                var rPairs = delta.removes[r][2][1];

                if (this.state.removes.get(rReplicaID) && this.state.removes.get(rReplicaID).get(rOperationID)) {
                    delta.removes = delta.removes.slice(0, r).concat(delta.removes.slice(r + 1, delta.removes.length));
                } else {
                    has = true;
                    var pairs = this.state.elements.get(rElement);
                    if (pairs) {
                        for (var i = 0; i < rPairs.length; i++) {
                            var k = rPairs[i][0];
                            var v = rPairs[i][1];
                            if (pairs.get(k) <= v) {
                                pairs.delete(k);
                            }
                        }
                        if (pairs.size() == 0) {
                            this.state.elements.delete(rElement);
                            change.removed.push(rElement);
                        }
                    }
                    if (!this.state.removes.contains(replicaID)) {
                        this.state.removes.set(replicaID, new ALMap());
                    }
                    this.state.removes.get(replicaID).set(rOperationID, [rElement, rPairs]);
                    this.state.removed.set(replicaID, rOperationID);
                }
            }
            if (change.removed.length == 0) {
                delete change.removed;
            }
            if (change.added.length == 0) {
                delete change.added;
            }


            console.info(has)
            console.info(change)
            console.info(delta)
            console.info("END APPLY set")
            if (change.removed || change.added)
                return {change: change, flattened: {delta: delta, vv: vv, meta: meta}};
            else if (has)
                return {change: null, flattened: {delta: delta, vv: vv, meta: meta}};
            else
                return {change: null, flattened: null};

        },
        getMeta: function () {
            return {added: this.state.added.toArray(), removed: this.state.removed.toArray()}
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_Set = delta_set;
} else {
    CRDT_LIB.DELTA_Set = delta_set;
}
if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

//TODO: 1:when removing elements remove them from the <adds> Map. 2: deltas ignore unfound adds(they were removed).

var delta_set = {
    type: "S",
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
            size: {
                local: function () {
                    return {
                        toInterface: this.state.elements.size(),
                        toNetwork: null
                    };
                },
                remote: function (data) {
                    //Never called.
                }
            },
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
                                e: element,
                                id: metadata.rID,
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
                    var pairs = this.state.elements.get(data.e);
                    if (!pairs) {
                        pairs = new ALMap();
                        this.state.elements.set(data.e, pairs);
                        added = true;
                    }

                    pairs.set(data.id, data.op);

                    if (!this.state.adds.contains(data.id)) {
                        this.state.adds.set(data.id, new ALMap());
                    }
                    this.state.adds.get(data.id).set(data.op, data.e);

                    this.state.added.set(data.id, data.op);

                    if (added)
                        return {added: data.e};
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
                                e: element,
                                p: pairs.toArray(),
                                id: metadata.rID,
                                op: ++this.state.oldElements
                            }
                        };
                    }
                }, remote: function (data) {
                    var removed = false;
                    var pairs = this.state.elements.get(data.e);
                    if (pairs) {
                        var receivedRemoves = data.p;
                        for (var i = 0; i < receivedRemoves.length; i++) {
                            var k = receivedRemoves[i][0];
                            var v = receivedRemoves[i][1];
                            if (pairs.get(k) <= v) {
                                pairs.delete(k);
                            }
                        }
                        if (pairs.size() == 0) {
                            this.state.elements.delete(data.e);
                            removed = true;
                        }
                    }


                    if (!this.state.removes.contains(data.id)) {
                        this.state.removes.set(data.id, new ALMap());
                    }
                    this.state.removes.get(data.id).set(data.op, [data.e, data.p]);
                    this.state.removed.set(data.id, data.op);

                    if (removed)
                        return {removed: data.e};
                    else
                        return null;
                }
            }
        },
        getDelta: function (vv, meta) {

            var ret = {a: [], r: []};

            var hisAdds = meta.a;
            var hisRemoves = meta.r;

            for (var i = 0; i < hisAdds && hisAdds.length; i++) {
                var k = hisAdds[i][0];
                var v = hisAdds[i][1];
                if (this.state.added.get(k) > v) {
                    for (var ai = v + 1; ai <= this.state.added.get(k); ai++) {
                        ret.a.push([k, ai, this.state.adds.get(k).get(ai)]);
                    }
                }
            }

            var myAdds = this.state.added.keys();
            for (var j = 0; j < myAdds.length; j++) {
                var found = false;
                for (var i = 0; hisAdds && i < hisAdds.length; i++) {
                    if (myAdds[j] == hisAdds[i][0]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (var ai = 1; ai <= this.state.added.get(myAdds[j]); ai++) {
                        ret.a.push([myAdds[j], ai, this.state.adds.get(myAdds[j]).get(ai)]);
                    }
                }
            }


            for (var j = 0; j < hisRemoves && hisRemoves.length; j++) {
                var k = hisRemoves[j][0];
                var v = hisRemoves[j][1];
                if (this.state.removed.get(k) > v) {
                    for (var ri = v + 1; ri <= this.state.removed.get(k); ri++) {
                        ret.r.push([k, ri, this.state.removes.get(k).get(ri)]);
                    }
                }
            }

            var myRemoves = this.state.removed.keys();
            for (var j = 0; j < myRemoves.length; j++) {
                console.info(myRemoves[j], found, this.state.removed.get(myRemoves[j]));
                var found = false;
                for (var i = 0; hisRemoves && i < hisRemoves.length; i++) {
                    if (myRemoves[j] == hisRemoves[i][0]) {
                        found = true;
                        break;
                    }
                }
                console.info(myRemoves[j], found, this.state.removed.get(myRemoves[j]));
                if (!found) {
                    for (var ai = 1; ai <= this.state.removed.get(myRemoves[j]); ai++) {
                        ret.r.push([myRemoves[j], ai, this.state.removes.get(myRemoves[j]).get(ai)]);
                    }
                }
            }

            console.info(ret);
            console.info("END getDelta Set");

            if (ret.r.length > 0 || ret.a.length > 0) {
                return ret;
            } else {
                return null;
            }

        },
        applyDelta: function (delta, vv, meta) {
            try {
                console.info("Start APPLY Set")
                console.info(delta)
                var has = false;
                var change = {added: [], removed: []};
                for (var a = 0; a < delta.a.length; a++) {
                    var rID = delta.a[a][0];
                    var opID = delta.a[a][1];
                    var element = delta.a[a][2];

                    if (this.state.adds.get(rID) && this.state.adds.get(rID).get(opID)) {
                        console.info("Already had op.");
                        delta.a = delta.a.slice(0, a).concat(delta.a.slice(a + 1, delta.a.length));
                    } else {
                        console.info("New op.");
                        has = true;
                        var pairs = this.state.elements.get(element);
                        if (!pairs) {
                            pairs = new ALMap();
                            this.state.elements.set(element, pairs);
                            change.added.push(element);
                        }
                        pairs.set(rID, opID);
                        if (!this.state.adds.contains(rID)) {
                            this.state.adds.set(rID, new ALMap());
                        }
                        this.state.adds.get(rID).set(opID, element);
                        this.state.added.set(rID, opID);
                    }
                }
                for (var r = 0; r < delta.r.length; r++) {
                    var rReplicaID = delta.r[r][0];
                    var rOperationID = delta.r[r][1];
                    var rElement = delta.r[r][2][0];
                    var rPairs = delta.r[r][2][1];

                    if (this.state.removes.get(rReplicaID) && this.state.removes.get(rReplicaID).get(rOperationID)) {
                        delta.r = delta.r.slice(0, r).concat(delta.r.slice(r + 1, delta.r.length));
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
                        if (!this.state.removes.contains(rReplicaID)) {
                            this.state.removes.set(rReplicaID, new ALMap());
                        }
                        this.state.removes.get(rReplicaID).set(rOperationID, [rElement, rPairs]);
                        this.state.removed.set(rReplicaID, rOperationID);
                    }
                }
                if (change.removed.length == 0) {
                    delete change.removed;
                }
                if (change.added.length == 0) {
                    delete change.added;
                }
            } catch (e) {
                console.error(delta);
                console.error(vv);
                console.error(meta);
                console.error(e);
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
            return {a: this.state.added.toArray(), r: this.state.removed.toArray()}
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_Set = delta_set;
} else {
    CRDT_LIB.DELTA_Set = delta_set;
}
if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

var delta_counter = {
    type: "C",
    crdt: {
        base_value: {
            dec: ALMap, inc: ALMap
        },
        getValue: function () {
            var value = 0;
            var decKeys = this.state.dec.keys();
            var incKeys = this.state.inc.keys();
            for (var decKey = 0; decKey < decKeys.length; decKey++) {
                value -= this.state.dec.get(decKeys[decKey]);
            }
            for (var incKey = 0; incKey < incKeys.length; incKey++) {
                value += this.state.inc.get(incKeys[incKey]);
            }
            return value;
        },
        operations: {
            increment: {
                local: function (amount, metadata) {
                    if (!metadata) {
                        metadata = amount;
                        amount = 1;
                    }
                    return {
                        toInterface: null,
                        toNetwork: {id: metadata.rID, amount: amount}
                    };
                }, remote: function (data) {
                    if (!this.state.inc.contains(data.id))
                        this.state.inc.set(data.id, 0);
                    this.state.inc.set(data.id, this.state.inc.get(data.id) + data.amount);
                    return data.amount;
                }
            },
            decrement: {
                local: function (amount, metadata) {
                    if (!amount) {
                        amount = 1;
                    }
                    return {
                        toInterface: null,
                        toNetwork: {id: metadata.rID, amount: amount}
                    };
                }, remote: function (data) {
                    if (!this.state.dec.contains(data.id))
                        this.state.dec.set(data.id, 0);
                    this.state.dec.set(data.id, this.state.dec.get(data.id) + data.amount);
                    return -data.amount;
                }
            }
        },

        getDelta: function (vv, meta) {
            var has = false;
            var ret = {incs: [], decs: []};

            var his_vv_keys = Object.keys(vv);
            for (var i = 0; i < his_vv_keys.length; i++) {
                if (keyIsOld({id: his_vv_keys[i], o: vv[his_vv_keys[i]]}, this.versionVector)) {
                    has = true;
                    if (this.state.inc.get(his_vv_keys[i]))
                        ret.incs.push({id: his_vv_keys[i], value: this.state.inc.get(his_vv_keys[i])});
                    if (this.state.dec.get(his_vv_keys[i]))
                        ret.decs.push({id: his_vv_keys[i], value: this.state.dec.get(his_vv_keys[i])});
                }
            }

            var myKeys = this.versionVector.getKeys();

            for (var j = 0; j < myKeys.length; j++) {
                if (!vv[myKeys[j]]) {
                    has = true;
                    if (this.state.inc.get(myKeys[j]))
                        ret.incs.push({id: myKeys[j], value: this.state.inc.get(myKeys[j])});
                    if (this.state.dec.get(myKeys[j]))
                        ret.decs.push({id: myKeys[j], value: this.state.dec.get(myKeys[j])});
                }
            }
            if (has)
                return ret;
            else
                return null;
        },
        applyDelta: function (delta, vv, meta) {
            var diff = 0;

            for (var inc_i = 0; inc_i < delta.incs.length; inc_i++) {
                var o_i = delta.incs[inc_i];
                if (!this.state.inc.contains(o_i.id))
                    this.state.inc.set(o_i.id, 0);

                if (this.state.inc.get(o_i.id) < o_i.value) {
                    diff += o_i.value - this.state.inc.get(o_i.id);
                    this.state.inc.set(o_i.id, o_i.value);
                } else {
                    delta.incs = delta.incs.slice(0, inc_i).concat(delta.incs.slice(inc_i + 1, delta.incs.length));
                }
            }
            for (var dec_i = 0; dec_i < delta.decs.length; dec_i++) {
                var o_d = delta.decs[dec_i];
                if (!this.state.dec.contains(o_d.id))
                    this.state.dec.set(o_d.id, 0);

                if (this.state.dec.get(o_d.id) < o_d.value) {
                    diff -= this.state.dec.get(o_d.id) - o_d.value;
                    this.state.dec.set(o_d.id, o_d.value);
                } else {
                    delta.decs = delta.decs.slice(0, dec_i).concat(delta.decs.slice(dec_i + 1, delta.decs.length));
                    dec_i--;
                }
            }

            if (delta.decs.length > 0 || delta.incs.length > 0)
                return {change: diff, flattened: {d: delta, vv: vv, m: meta}};
            else if (diff != 0) {
                return {change: diff, flattened: null};
            } else
                return {change: null, flattened: null}
        },
        getMeta: function () {
            return null;
        }
    }
};

/**
 *
 * @param key
 * @param vv {VersionVector}
 * @returns {boolean}
 */
var keyIsOld = function (key, vv) {
    var mine = vv.get(key.id);
    if (mine) {
        return vv.get(key.id) > key.o;
    } else {
        return false;
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_Counter = delta_counter;
} else {
    CRDT_LIB.DELTA_Counter = delta_counter;
}

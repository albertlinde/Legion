//TODO: make this self-contained.
if (typeof exports != "undefined")
    exports.Duplicates = Duplicates;

/**
 * Creates new Duplicates instance.
 * @constructor
 */
function Duplicates() {
    this.senders = [];
}
/**
 * Keeps M_IDs for each S_ID,
 * @param S_ID
 * @param M_ID
 */
Duplicates.prototype.add = function (S_ID, M_ID) {
    if (!this.senders[S_ID]) {
        this.senders[S_ID] = new RangeSet();
    }
    this.senders[S_ID].add(M_ID);
};
/**
 *
 * @param S_ID
 * @param M_ID
 * @returns {boolean}
 */
Duplicates.prototype.contains = function (S_ID, M_ID) {
    if (!this.senders[S_ID]) {
        return false
    }
    return this.senders[S_ID].contains(M_ID);
};
/**
 * For debug.
 */
Duplicates.prototype.print = function () {

    var ks = Object.keys(this.senders);

    for (var i = 0; i < ks.length; i++) {
        console.log(ks[i]);
        this.senders[ks[i]].print();
    }
};
/**
 * Creates new RangeSet instance
 * @constructor
 */
function RangeSet() {
    this.pairs = [];
}
/**
 * Adds a new element.
 * @param M_ID
 */
RangeSet.prototype.add = function (M_ID) {
    for (var i = this.pairs.length - 1; i >= 0; i--) {
        if (M_ID >= this.pairs[i].first && M_ID <= this.pairs[i].last)
            return;//Already exists;
        if (M_ID == this.pairs[i].last + 1) {
            this.pairs[i].last += 1;
            while ((this.pairs[i - 1]) && this.pairs[i].last == this.pairs[i - 1].first - 1) {
                this.pairs[i].last = this.pairs[i - 1].last;
                this.pairs.splice(i - 1, 1);
                i--;
            }
            return;
        }
        if (M_ID == this.pairs[i].first - 1) {
            this.pairs[i].first -= 1;
            return;
        }
        if (M_ID < this.pairs[i].first) {
            this.pairs.splice(i + 1, 0, {first: M_ID, last: M_ID});
            return;
        }
    }
    this.pairs.splice(0, 0, {first: M_ID, last: M_ID});
};

/**
 * Checks existence of element.
 * @param M_ID
 * @returns {boolean}
 */
RangeSet.prototype.contains = function (M_ID) {
    for (var i = 0; i < this.pairs.length; i++) {
        if (M_ID >= this.pairs[i].first && M_ID <= this.pairs[i].last)
            return true;

    }
    return false;
};
/**
 * For debugging.
 */
RangeSet.prototype.print = function () {
    for (var i = 0; i < this.pairs.length; i++) {
        console.log(this.pairs[i].first + " : " + this.pairs[i].last);
    }
};
/**
 * Slices arrays.
 * @param array
 * @param pos
 * @returns {string}
 */
var arraySlicer = function (array, pos) {
    return array.slice(0, pos).concat(array.slice(pos + 1, array.length));
};


/**
 * https://en.wikipedia.org/wiki/Cosine_similarity
 * https://en.wikipedia.org/wiki/Canberra_distance
 * https://en.wikipedia.org/wiki/Sørensen–Dice_coefficient
 * @param arr1
 * @param arr2
 * @returns {number}
 */
function distanceFunction(arr1, arr2) {
    var INTERVAL = 70;
    /*var sum1 = 0;
     var sum2 = 0;
     var sum3 = 0;

     var canberra = 0;
     var Czekanowski1 = 0;
     var Czekanowski2 = 0;
     */
    var intervalCount = 0;

    for (var i = 0; i < arr1.length && i < arr2.length; i++) {
        /*sum1 += arr1[i] * arr2[i];
         sum2 += arr1[i] * arr1[i];
         sum3 += arr2[i] * arr2[i];

         canberra += Math.abs(arr1[i] - arr2[i]) / (arr1[i] + arr2[i]);

         Czekanowski1 += (arr1[i] * arr2[i]);
         Czekanowski2 += (arr1[i] * arr1[i] + arr2[i] * arr2[i]);
         */
        if (Math.abs(arr1[i] - arr2[i]) > INTERVAL) {
            intervalCount++;
        }
    }
    /*var similarity = (sum1 / (Math.sqrt(sum2) * Math.sqrt(sum3)));

     var distance = Math.acos(similarity) * 2 / Math.PI;

     var Sørensen = (2 * Czekanowski1) / Czekanowski2;

     return [similarity, distance, 1 - distance, 2 * sum1 / (sum2 + sum3), canberra, Sørensen, intervaledCount];
     */
    return intervalCount;
}

function randInt(N) {
    if (!N) N = Number.MAX_SAFE_INTEGER;
    return Math.floor((Math.random() * Number.MAX_VALUE) % (Math.pow(10, N)));
}

if (typeof exports != "undefined") {
    exports.distanceFunction = distanceFunction;
    exports.randInt = randInt;
}
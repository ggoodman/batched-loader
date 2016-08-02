'use strict';

const Assert = require('assert');


module.exports = class InflightRequests {
    constructor() {
        this.requests = [];
    }

    add(batch) {
        this.requests.push(batch);
        batch.onComplete(() => {
            const idx = this.requests.indexOf(batch);

            Assert.ok(idx >= 0, 'An in-flight request batch signalled completion but it is not being tracked');

            this.requests.splice(idx, 1);
        });
    }

    get(key) {
        for (let i in this.requests) {
            const found = this.requests[i].get(key);

            if (found) {
                return found;
            }
        }
    }
};

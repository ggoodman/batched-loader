'use strict';

const Assert = require('assert');
const Batch = require('./batch');
const InflightRequests = require('./inflightRequests');
const Notifier = require('./notifier');
const Request = require('./request');


module.exports = {
    createLoader,
    Batch,
    InflightRequests,
    Notifier,
    Request,
};


function createLoader(issueBatch, options) {
    if (typeof options === 'undefined') {
        options = {};
    }
    
    Assert.ok(typeof issueBatch === 'function', 'issueBatch must be a function');
    Assert.ok(typeof options === 'object', 'if specified, options must be an object');
    Assert.ok(typeof options.generateKey === 'function' || typeof options.generateKey === 'undefined', 'if specified, options.generateKey must be a function');
    Assert.ok(typeof options.timeoutMs === 'number' || typeof options.timeoutMs === 'undefined', 'if specified, options.timeoutMs must be a number');
    Assert.ok(typeof options.windowMs === 'number' || typeof options.windowMs === 'undefined', 'if specified, options.windowMs must be a number');

    options.issueBatch = issueBatch;

    if (!options.generateKey) {
        options.generateKey = defaultKeyGenerator;
    }

    if (typeof options.timeoutMs === 'undefined') {
        options.timeoutMs = 5000;
    }

    if (typeof options.windowMs === 'undefined') {
        // Set the window time to 0 to issue a batched request for all
        // requests in a event loop tick.
        options.windowMs = 0;
    }

    const inflight = new InflightRequests();
    let pending = new Batch(options);
    let batchScheduled = false;

    return function batchedLoader(target, cb) {
        Assert.ok(typeof cb === 'function', 'A callback function is required when invoking the batched loader function');

        const key = options.generateKey(target);
        const underway = pending.get(key) || inflight.get(key);

        if (underway) {
            return underway.notify(cb);
        }

        const request = new Request(key);

        request.notify(cb);

        pending.add(key, request);

        scheduleBatch();
    };


    function executeBatch() {
        const batch = pending;

        inflight.add(batch);
        batch.execute();

        pending = new Batch(options);
        batchScheduled = false;
    }

    function scheduleBatch() {
        if (!batchScheduled) {
            if (options.windowMs) {
                setTimeout(() => executeBatch(), options.windowMs);
            } else {
                process.nextTick(() => executeBatch());
            }

            batchScheduled = true;
        }
    }
}


function defaultKeyGenerator(target) {
    switch (typeof target) {
        case 'string':
        case 'number':
        case 'boolean':
            return target;
    }

    throw new Error('A custom generateKey function is needed when keys are not String, Number or Booleans');
}

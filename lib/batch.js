'use strict';

const Assert = require('assert');
const Notifier = require('./notifier');


module.exports = class Batch {
    constructor(options) {
        this.issueBatch = options.issueBatch;
        this.requests = new Map();
        this.timeoutMs = options.timeoutMs;
        this.timeoutId = 0;
        this.completed = false;
        this.completionHandlers = [];
    }

    add(key, request) {
        return this.requests.set(key, request);
    }

    onComplete(cb) {
        this.completionHandlers.push(cb);
    }

    signalComplete(error) {
        if (this.completed) {
            return;
        }

        if (!error) {
            error = new Error('The request batch completed without generating a result for this key');
            error.isNotFound = true;
        }

        // Toggle the completed flag to detect repeat calls
        this.completed = true;

        clearTimeout(this.timeoutId);

        this.requests.forEach((request, key) => {
            if (!request.isCompleted()) {
                request.signalError(error);
            }
        });

        while (this.completionHandlers.length) {
            this.completionHandlers.shift()();
        }
    }
    
    signalDeferredResult(key, deferral) {
        const request = this.requests.get(key);

        Assert.ok(request, `Attempting to signal a deferred result for an unknown key: ${key}`);

        request.signalDeferredResult(deferral);
    }

    signalError(key, error) {
        const request = this.requests.get(key);

        Assert.ok(request, `Attempting to signal an error for an unknown key: ${key}`);

        request.signalError(error);
    }

    signalResult(key, result) {
        const request = this.requests.get(key);

        Assert.ok(request, `Attempting to signal a result for an unknown key: ${key}`);

        request.signalResult(result);
    }

    execute(context) {
        this.timeoutId = setTimeout(() =>
            this.signalComplete(new Error(`The batched request timed out after ${this.timeoutMs}ms`))
        , this.timeoutMs);

        const keys = Array.from(this.requests.keys());
        const notifier = new Notifier(this);

        this.issueBatch.call(context, keys, notifier);
    }

    get(key) {
        return this.requests.get(key);
    }
};

'use strict';


module.exports = class Notifier {
    constructor(batch) {
        this.batch = batch;
        this.deferred = [];
    }
    
    complete(error) {
        this.batch.signalComplete(error);
    }

    defer(key, deferral) {
        this.batch.signalDeferredResult(key, deferral);
    }

    error(key, error) {
        this.batch.signalError(key, error);
    }

    result(key, value) {
        this.batch.signalResult(key, value);
    }
}
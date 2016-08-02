'use strict';


module.exports = class Notifier {
    constructor(batch) {
        this.batch = batch;
    }

    complete(error) {
        this.batch.signalComplete(error);
    }

    error(key, error) {
        this.batch.signalError(key, error);
    }

    result(key, value) {
        this.batch.signalResult(key, value);
    }
}
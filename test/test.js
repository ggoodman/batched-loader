'use strict';

const Batcher = require('../');
const Code = require('code');
const Lab = require('lab');

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const expect = Code.expect;
const it = lab.it;


describe('The batched loader factory function', { parallel: true }, () => {
    describe('parameter validation', () => {
        it('fails when no options specified', done => {
            const factory = () => Batcher.createLoader();

            expect(factory).to.throw(Error, 'issueBatch must be a function');

            done();
        });

        it('fails with an invalid issueBatch option', done => {
            let issueBatch = undefined;

            const factory = () => Batcher.createLoader(issueBatch);

            expect(factory).to.throw(Error, 'issueBatch must be a function');
            issueBatch = 'invalid';
            expect(factory).to.throw(Error, 'issueBatch must be a function');
            issueBatch = () => {};
            expect(factory).to.not.throw();

            done();
        });

        it('fails with an invalid generateKey option', done => {
            let generateKey = 'invalid';
            const issueBatch = () => {};
            const factory = () => Batcher.createLoader(issueBatch, { generateKey });

            expect(factory).to.throw(Error, 'if specified, options.generateKey must be a function');
            generateKey = () => {};
            expect(factory).to.not.throw();
            generateKey = undefined;
            expect(factory).to.not.throw();

            done();
        });

        it('fails with an invalid timeoutMs option', done => {
            let timeoutMs = 'invalid';
            const issueBatch = () => {};
            const factory = () => Batcher.createLoader(issueBatch, { timeoutMs });

            expect(factory).to.throw(Error, 'if specified, options.timeoutMs must be a number');
            timeoutMs = 300;
            expect(factory).to.not.throw();
            timeoutMs = undefined;
            expect(factory).to.not.throw();

            done();
        });

        it('fails with an invalid windowMs option', done => {
            let windowMs = 'invalid';
            const issueBatch = () => {};
            const factory = () => Batcher.createLoader(issueBatch, { windowMs });

            expect(factory).to.throw(Error, 'if specified, options.windowMs must be a number');
            windowMs = 300;
            expect(factory).to.not.throw();
            windowMs = undefined;
            expect(factory).to.not.throw();

            done();
        });

        it('fails when no generateKey option is provided and an unsupported key type is used', done => {
            let key = { an: 'object' };
            const cb = () => {};
            const issueBatch = () => {};
            const loader = Batcher.createLoader(issueBatch);
            const load = () => {
                loader(key, cb);
            };

            expect(load).to.throw(Error, 'A custom generateKey function is needed when keys are not String, Number or Booleans');
            key = 'key';
            expect(load).to.not.throw();
            key = 1;
            expect(load).to.not.throw();
            key = true;
            expect(load).to.not.throw();

            done();
        });
    });

    it('produces a loader function with correct parameters', done => {
        const issueBatch = () => {};
        const loader = Batcher.createLoader(issueBatch);

        expect(loader).to.be.a.function();

        done();
    });
});

describe('the issueBatch option', { parallel: true }, () => {
    it('will throw if no callback is provided', done => {
        const issueBatch = () => {};
        const loader = Batcher.createLoader(issueBatch);
        const load = () => {
            loader('key');
        };

        expect(load).to.throw(Error, 'A callback function is required when invoking the batched loader function');

        done();
    });
    it('will be invoked for a single key', done => {
        const cb = () => {};
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            done();
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', cb);
    });

    it('will be invoked for multiple keys', done => {
        const cb = () => {};
        const requests = ['a', 'b', 'c'];
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(requests.length);
            expect(keys).to.equal(requests);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            done();
        };
        const loader = Batcher.createLoader(issueBatch);

        requests.forEach(key => loader(key, cb));
    });

    it('will be invoked once per tick', done => {
        let request = 0;
        const cb = () => {};
        const requests = [['a', 'b', 'c'], ['d', 'e', 'f']];
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(requests[request].length);
            expect(keys).to.equal(requests[request]);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            if (++request === requests.length) {
                done();
            }
        };
        const loader = Batcher.createLoader(issueBatch);

        requests[0].forEach(key => loader(key, cb));

        process.nextTick(() => requests[1].forEach(key => loader(key, cb)));
    });

    it('will will not be invoked on the next tick when windowMs is provided', done => {
        const now = Date.now();
        const cb = () => {};
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys).to.equal(['key']);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);
            expect(Date.now() - now).to.be.about(windowMs, 50);

            done();
        };
        const windowMs = 300;
        const loader = Batcher.createLoader(issueBatch, { windowMs });

        loader('key', cb);
    });

    it('will be invoked once per windowMs', done => {
        let request = 0;
        const cb = () => {};
        const requests = [['a', 'b', 'c'], ['d', 'e', 'f']];
        const windowMs = 300;
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(requests[request].length);
            expect(keys).to.equal(requests[request]);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            if (++request === requests.length) {
                done();
            }
        };
        const loader = Batcher.createLoader(issueBatch, { windowMs });

        setTimeout(() => requests[0].forEach(key => loader(key, cb)), windowMs / 2);
        setTimeout(() => requests[1].forEach(key => loader(key, cb)), windowMs * 2);
    });

    it('will be invoked once for duplicate keys', done => {
        const cb = () => {};
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            done();
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', cb);
        loader('key', cb);
    });

    it('will be invoked once for duplicate keys with a larger window', done => {
        const cb = () => {};
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            done();
        };
        const windowMs = 300;
        const loader = Batcher.createLoader(issueBatch, { windowMs });

        setTimeout(() => loader('key', cb), 0);
        setTimeout(() => loader('key', cb), windowMs - 100);
    });
});

describe('the batched loader', { parallel: true }, () => {
    it('will load a single batched request for synchronous notification', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            keys.forEach(key => notifier.result(key, key));
            notifier.complete();
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.not.exist();
            expect(value).to.equal('key');

            done();
        });
    });

    it('will load a single batched request if the same key is requested multiple times during the request window', done => {
        let batchesIssued = 0;
        let callbacksFired = 0;
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            batchesIssued++;

            setTimeout(() => {
                keys.forEach(key => notifier.result(key, key));
                notifier.complete();
            }, windowMs);
        };
        const windowMs = 300;
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            callbacksFired++;

            expect(error).to.not.exist();
            expect(value).to.equal('key');
            expect(batchesIssued).to.equal(1);
            expect(callbacksFired).to.equal(1);
        });

        setTimeout(() => {
            loader('key', (error, value) => {
                callbacksFired++;

                expect(error).to.not.exist();
                expect(value).to.equal('key');
                expect(batchesIssued).to.equal(1);
                expect(callbacksFired).to.equal(2);
            });

        }, 1 * windowMs / 3);

        setTimeout(() => {
            loader('key', (error, value) => {
                callbacksFired++;

                expect(error).to.not.exist();
                expect(value).to.equal('key');
                expect(batchesIssued).to.equal(1);
                expect(callbacksFired).to.equal(3);

                done();
            });

        }, 2 * windowMs / 3);
    });

    it('will load a single batched request for an asynchronous notification', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            setTimeout(() => {
                keys.forEach(key => notifier.result(key, key));
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.not.exist();
            expect(value).to.equal('key');

            done();
        });
    });

    it('will invoke the callback with an error for a batched request for synchronous failure', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            keys.forEach(key => notifier.error(key, new Error(key)));
            notifier.complete();
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.be.an.error(Error, 'key');
            expect(value).to.not.exist();

            done();
        });
    });

    it('will invoke the callback with an error for a batched request for asynchronous failure', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            setTimeout(() => {
                keys.forEach(key => notifier.error(key, new Error(key)));
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.be.an.error(Error, 'key');
            expect(value).to.not.exist();

            done();
        });
    });

    it('will result in an errback when the batch loader completes without a result for the key', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            setTimeout(() => {
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.be.an.error(Error, 'The request batch completed without generating a result for this key');
            expect(value).to.not.exist();

            done();
        });
    });

    it('will time out when the batch loader function takes too long', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            setTimeout(() => {
                keys.forEach(key => notifier.result(key, key));
                notifier.complete();
            }, timeoutMs * 2);
        };
        const timeoutMs = 150;
        const loader = Batcher.createLoader(issueBatch, { timeoutMs });

        loader('key', (error, value) => {
            expect(error).to.be.an.error(Error, `The batched request timed out after ${timeoutMs}ms`);
            expect(value).to.not.exist();

            done();
        });
    });

    it('will time out when the batch loader function takes too long and the load eventually fails', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            setTimeout(() => {
                keys.forEach(key => notifier.error(key, new Error(key)));
                notifier.complete();
            }, timeoutMs * 2);
        };
        const timeoutMs = 150;
        const loader = Batcher.createLoader(issueBatch, { timeoutMs });

        loader('key', (error, value) => {
            expect(error).to.be.an.error(Error, `The batched request timed out after ${timeoutMs}ms`);
            expect(value).to.not.exist();

            done();
        });
    });

    it('will allow loading of the same key while in the synchronous scope of the load callback', done => {
        let batchesIssued = 0;
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            batchesIssued++;

            setTimeout(() => {
                keys.forEach(key => notifier.result(key, key));
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.not.exist();
            expect(value).to.equal('key');

            loader('key', (error, value) => {
                expect(error).to.not.exist();
                expect(value).to.equal('key');
                expect(batchesIssued).to.equal(1);

                done();
            });
        });
    });

    it('will allow loading of the same key while in the synchronous scope of the load callback when the load failed', done => {
        let batchesIssued = 0;
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            batchesIssued++;

            setTimeout(() => {
                keys.forEach(key => notifier.error(key, new Error(key)));
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.be.an.error(Error, 'key');
            expect(value).to.not.exist();

            loader('key', (error, value) => {
                expect(error).to.be.an.error(Error, 'key');
                expect(value).to.not.exist();
                expect(batchesIssued).to.equal(1);

                done();
            });
        });
    });

    it('will allow loading of a different key while in the synchronous scope of the load callback', done => {
        let batchesIssued = 0;
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            batchesIssued++;

            setTimeout(() => {
                keys.forEach(key => notifier.result(key, key));
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.not.exist();
            expect(value).to.equal('key');

            loader('key2', (error, value) => {
                expect(error).to.not.exist();
                expect(value).to.equal('key2');
                expect(batchesIssued).to.equal(2);

                done();
            });
        });
    });

    it('will load two batched requests for an asynchronous notification', done => {
        const issueBatch = (keys, notifier) => {
            expect(keys).to.be.an.array().and.to.have.length(1);
            expect(keys[0]).to.equal('key');
            expect(notifier).to.be.an.instanceOf(Batcher.Notifier);

            setTimeout(() => {
                keys.forEach(key => notifier.result(key, key));
                notifier.complete();
            }, 300);
        };
        const loader = Batcher.createLoader(issueBatch);

        loader('key', (error, value) => {
            expect(error).to.not.exist();
            expect(value).to.equal('key');

            done();
        });
    });
});

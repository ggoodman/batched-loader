# Batched Loader

Create a loader function that transparently batches loads either by event loop tick or by a configurable window.

> I have an array of Blog objects that I just got from Mongo (that doesn’t support joins) and I want to join the relevant User objects before responding. However, I don’t want to one request for each Blog post because I know some posts share users and I know that Mongo can return multiple users in a single query more efficiently.

## Rationale

This tool is designed to help reduce costly round-trips for two scenarios:

1. Requests to an asynchronous service have important overhead that can be reduced by batching multiple requests.
2. Clusters of requests for the same data may be issued throughout a codebase and could be optimized by sharing the same request to the underlying service.

Caching is not provided by this tool because it could easily be enabled by putting the batched loader function behind a transparent, read-through cache library like [async-cache](https://www.npmjs.com/package/async-cache) or [catbox](https://www.npmjs.com/package/catbox).

## Example

```js
const Batcher = require('batched-loader');
const MongoClient = require('mongodb').MongoClient;

const options = {
    timeoutMs: 2000, // Automatically fail loads that take more than 2s
};
const loaderUser = Batcher.createLoader((keys, notifier) => {
    MongoClient.connect(process.env.MONGO_URL, (error, db) => {
        // handle error

        // Make one request to mongo for many keys
        const query = { _id: { $in: keys } };
        const cursor = db.collection('users').find(query);

        // Iterate through the cursor and signal
        cursor.forEach(
            // For each document returned, notify the batch that a result was
            // fulfilled for the given key.
            (doc) => notifier.result(doc._id, doc),
            // Signal to the notifier that the batch is complete and pass along
            // any error to all un-fulfilled requests in the batch.
            (error) => notifier.complete(error)
        );
    })
}, options);

loadUser('ggoodman', (error, user) => {
    // Interact with the loadUser function like a typical node-style
    // asynchronous function.
});

// ... later in the same event loop tick (or within the window defined by
// the windowMs option)
loadUser('ggoodman', /* The request for ggoodman above will be re-used */);
loadUser('gbadman', /* A second key will be added to the single request batch */);
```

## API

### `createLoader(loadKeys, [options])`

Creates a batched loader function where:

- `loadKeys(keys, notifier)` - the function that will issue a batch where:
    - `keys` - an array of keys that should be loaded.
    - `notifier` - a [`Notifier`](#notifier) instance to be used to signal results, errors and the completion of the batch.
- `options` - an object containing:
    - `context` - an optional context object that will be set as the `loadKeys` function's receiver (`this` object).
    - `generateKey(request)` - a function that should convert the `request` item into a key that the `issueBatch` function can handle.
    - `timeoutMs` - the number of milliseconds after which a batch will time out (defaults to `5000` ms).
    - `windowMs` - the number of milliseconds that determine the window for inclusion in the current batch (defaults to `0` which means in the same tick).

Returns a function with the signature `loader(request, callback)` where:

- `request` - is either a `String`, `Number`, or `Boolean` or is an object that is accepted by the `generateKey` function above.
- `callback(error, result)` - is a callback function that will be invoked with either an error or the result of the batched load.

### `Notifier`

Interface for the `notifier` object of the `loadKeys` function where:

- `notifier.result(key, value)` - signal that `value` was loaded for `key`.
- `notifier.error(key, error)` - signal that the error `error` was loaded for `key`.
- `notifier.complete([error])` - signal that the batch has completed and that any unfulfilled requests should be fulfilled with the optional error argument. If no `error` is specified, a default error will be used.

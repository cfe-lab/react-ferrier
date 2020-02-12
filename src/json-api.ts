import {Mime} from "./Mime";
import {urlFor} from "./urlFor";
import {History} from "history";

let LOGGING = false;
let logger: Function = console.log;

export function enableLogging(newLogger = logger) {
    LOGGING = true;
    if (newLogger && typeof newLogger == 'function') {
        logger = newLogger;
    }
}
export function disableLogging() {
    LOGGING = false;
}

type Method = 'GET'|'POST'|'PATCH'|'PUT'|'DELETE'|'LINK'|'UNLINK';
type MethodLower = 'get'|'post'|'patch'|'put'|'delete'|'link'|'unlink';
type SuccessFn = (response: any) => void;
type FailureFn = (message: string) => void;
type JsonApiFn = (url: string, data?: any, options?: {routeWith?: History}) => CancellablePromise<any>;

// some literal constants
const GET: Method = 'GET';
const POST: Method = 'POST';
const PATCH: Method = 'PATCH';
const PUT: Method = 'PUT';
const DELETE: Method = 'DELETE';
const LINK: Method = 'LINK';
const UNLINK: Method = 'UNLINK';

/**
 * Make JsonApi functions return a Promise instead of requiring callbacks
 * UPDATED with new traps to enable use of Sinon spies and stubs
 * ALSO UPDATED to accept a history to route
 */
const promiseApiCache = {};
const wrap = (fn: Function) => (url: string, data?: any, options: {routeWith?: History} = {}) => {
    let xhr: XMLHttpRequest;
    let promise = new Promise<void>(
        (success, fail) => {
            xhr = fn(url, data, success, fail);
        }
    );
    let history: History;
    if (history = options.routeWith) {
        promise = promise.then(
            ({message, ...redirect}: any) => {
                if (Object.keys(redirect).length > 0) {
                    history.push({
                        ...history.location,
                        pathname: urlFor(redirect),
                        state: {serverMessage: message}
                    })
                } else {
                    history.replace({
                        ...history.location,
                        state: {serverMessage: message}
                    })
                }
            },
            (error: string) => {
                history.replace({
                    ...history.location,
                    state: {errorMessage: error}
                })
            }
        );
    }
    return makeCancellablePromise(promise, () => {
        if (xhr) xhr.abort();
        else throw "XMLHttpRequest cannot be canceled before it is initiated."
    });
};

/**
 * Functions for RESTful API operations.
 * Every method has the same signature:
 * (url: string, data?: any, success?: SuccessFn, fail?: FailureFn): void
 */
export default {
    get: wrap((url: string, data?: any, ...callbacks: ((arg: string) => void)[]) => {
        if (data) {
            url += '?' + serializeUri(data);
        }
        return send.call(null, GET, url, {}, ...callbacks);
    }),
    post: wrap((...args: any[]) => {
        return send.call(null, POST, ...args);
    }),
    patch: wrap((...args: any[]) => {
        return send.call(null, PATCH, ...args);
    }),
    put: wrap((...args: any[]) => {
        return send.call(null, PUT, ...args);
    }),
    link: wrap((...args: any[]) => {
        return send.call(null, LINK, ...args);
    }),
    unlink: wrap((...args: any[]) => {
        return send.call(null, UNLINK, ...args);
    }),
    'delete': wrap((...args: any[]) => {
        return send.call(null, DELETE, ...args);
    })
} as Record<MethodLower, JsonApiFn>;

/**
 * Recursively enhance returned Promise objects to include a cancel() method.
 * We could mutate the object prototype - but I don't think that would be simpler, and certainly not cleaner.
 */
function makeCancellablePromise<T>(promise: CancellablePromise<T>, onCancel: () => void): CancellablePromise<T> {
    let then = promise.then;
    let katch = promise.catch;
    promise.then = function() {
        return makeCancellablePromise(then.apply(this, arguments), onCancel);
    };
    promise.catch = function() {
        return makeCancellablePromise(katch.apply(this, arguments), onCancel);
    };
    promise.cancel = onCancel;
    return promise;
}

/**
 * The base send function.
 */
function send(
    method: Method,
    url: string,
    data?: any,
    success: SuccessFn = () => null,
    fail: FailureFn = err => { throw new Error(`${err}`) },
    contentType: string = Mime.json.utf8
) {
    log(`${method.toLowerCase()} ${url}`);
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Accept", Mime.json.utf8);
    xhr.timeout = 90 * 1000;
    if (contentType) {
        xhr.setRequestHeader("Content-Type", contentType);
    }
    xhr.onload = function() {
        const locationHeader = xhr.getResponseHeader('Location');
        if (xhr.status >= 200 && xhr.status < 300) {
            if (locationHeader) {
                doSuccess(success, xhr.responseText, locationHeader);
            } else {
                doSuccess(success, xhr.responseText);
            }
        } else {
            doError(fail, xhr.responseText);
        }
    };
    xhr.onreadystatechange = function(e) {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 0) {
            fail("Could not reach the server");
        }
    };
    xhr.onabort = function() {
        xhr.onload = null;
        xhr.onreadystatechange = null;
    };
    xhr.send(data && JSON.stringify(data));
    return xhr;
}

/**
 * Try to parse a server response as JSON.
 * If the server responded anomalously, just return the raw response.
 */
function doSuccess(callback: SuccessFn, response: string, redirectTo?: string) {
    let parsed;
    try {
        parsed = JSON.parse(response);
        if (redirectTo) {
            parsed.redirectTo = redirectTo;
        }
    } catch(e) {
        parsed = response;
    }
    callback(parsed);
}

/**
 * Try to parse a server error response as JSON.
 * If that doesn't work, just return the raw response.
 */
function doError(callback: FailureFn, response: string) {
    try {
        // ideal case: server res
        const data = JSON.parse(response);
        callback((data.error === '' ? '(no message provided)' : data.error) || data);
    } catch(e) {
        // some error occurred and details are not available
        callback(response || "Server returned with an unexpected response");
    }
}

function serializeUri(obj: any) {
    let params = [];
    for (let key in obj) if (obj.hasOwnProperty(key) && obj[key] !== undefined && obj[key] !== null) {
        params.push(key + "=" + encodeURIComponent(obj[key]));
    }
    return params.join("&");
}

function log(msg: string): void {
    if (LOGGING) {
        logger(`JsonApi: ${msg}`);
    }
}
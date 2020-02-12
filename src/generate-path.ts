import {compile} from "path-to-regexp";

/**
 * Taken from react-router
 *
 */
const cache: Record<string, {protocolAndHostname: string, generator: (a: object, b: object) => string}> = {};
const cacheLimit = 10000;
let cacheCount = 0;

function compilePath(path: string) {
    let protocolAndHostname = '';
    if (/^https?:\/\//.test(path)) {
        [protocolAndHostname] = path.match(/^https?:\/\/[^\/@]+\//);
        path = path.substr(protocolAndHostname.length);
    }

    if (cache[path]) return cache[path];

    const generator = compile(path);

    if (cacheCount < cacheLimit) {
        cache[path] = {protocolAndHostname, generator};
        cacheCount++;
    }

    return {protocolAndHostname, generator};
}

/**
 * Public API for generating a URL pathname from a path and parameters.
 */
function generatePath(path: string = "/", params = {}) {
    let {protocolAndHostname, generator} = compilePath(path);
    return path === "/" ? path : (protocolAndHostname + generator(params, { pretty: true }));
}

export default generatePath;
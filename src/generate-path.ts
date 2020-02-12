import pathToRegexp from "path-to-regexp";

/**
 * Taken from react-router
 *
 */
const cache: Record<string, (a: object, b: object) => string> = {};
const cacheLimit = 10000;
let cacheCount = 0;

function compilePath(path: string) {
    if (cache[path]) return cache[path];

    const generator = pathToRegexp.compile(path);

    if (cacheCount < cacheLimit) {
        cache[path] = generator;
        cacheCount++;
    }

    return generator;
}

/**
 * Public API for generating a URL pathname from a path and parameters.
 */
function generatePath(path: string = "/", params = {}) {
    return path === "/" ? path : compilePath(path)(params, { pretty: true });
}

export default generatePath;
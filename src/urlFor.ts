
let urlForInner = <T extends UrlOpts>(opts: Partial<T> = {}) => {
    /**
     * port of erb_helper.rb #url_for
     * skips the host/protocol since React Router does not support that (and shouldn't need it, anyway)
     */

    const match: Partial<UrlOpts> = {};
    [, match.controller, match.action] = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    const [action, controller] =
        ['action', 'controller'].map(actcon => {
            const result = opts[actcon] || match[actcon];
            delete opts[actcon];
            return result;
        });
    const optsStr = Object.keys(opts).map(key =>
        [key, opts[key]].map(encodeURIComponent).join('=')
    ).join('&');
    return `/${controller}/${action}${optsStr && '?' + optsStr}`;
};

export function setUrlInterpreter(newInterpreter: <T extends UrlOpts>(opts: Partial<T>) => string) {
    urlForInner = newInterpreter;
}

export const urlFor = (...params: any[]) => {
    return urlForInner(...params);
};
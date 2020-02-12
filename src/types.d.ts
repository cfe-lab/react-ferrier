
interface KeyValuePair { [key: string]: string; }
type Optionalize<T, K extends keyof T> = Partial<Pick<T, K>> & Pick<T, Exclude<keyof T, K>>;

interface ReactElement {
    type: any;
    props: any;
    key: string | number | null;
}
type ReactChild = string | number | ReactElement;
interface ServerComms {
    errorMessage?: ReactChild;
    serverMessage?: ReactChild;
    redirectTo?: string|any;
}

interface GettersSetters<T> {
    get: T;
    set<K extends keyof T>(key: K): (val: T[K]) => void
}
type DefaultApiParams = { id: number|string };

interface ServerHooks {
    onError?(error: string|Error): any
    onMessage?(message: string): any
}
interface ApiQueryShorthand<T = DefaultApiParams> {
    apiQuery?: T
    id?: string|number
}

interface UrlOpts {
    action: string
    controller: string
    [key: string]: string
}

interface CancellablePromise<T> extends Promise<T> {

    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): CancellablePromise<TResult1 | TResult2>;

    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): CancellablePromise<T | TResult>;

    cancel?(): void
}
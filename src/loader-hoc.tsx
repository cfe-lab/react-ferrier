import * as React from 'react';
import {deepCompare} from "./helpers";
import JsonApi from "./json-api";
import generatePath from "./generate-path";

/**
 * @docs
 *
 * Making a basic loader
 *
 *   let ComponentLoader = LoaderHOC<ResultType>(url)(Component)
 *   <ComponentLoader id={id} />
 *    => <Component id={id} data=[...] />
 *
 * The Loader will handle its own server errors / loading animations.
 *
 * An empty array response will result in an error message.
 *
 * Passing props through the loader
 *
 *   let ComponentLoader = LoaderHOC<ResultType, { passedThru: any }>(url)(Component)
 *   <ComponentLoader id={id} passedThru={{ foo: 'bar' }} />
 *    => <Component id={id} data=[...] passedThru={{ foo: 'bar' }} />
 *
 * Setting API request parameters
 *
 *   let ComponentLoader = LoaderHOC<ResultType, {}, { id: number, apiFlag: boolean }>(url)(Component)
 *   <ComponentLoader apiQuery={{ id: 1, apiFlag: true }} />
 *    => <Component id={1} apiFlag={true} />
 *
 * Custom API parameter computation
 *
 *   let ComponentLoader = LoaderHOC<ResultType, { passedThru: string }>(
 *       url,
 *       { getApiQuery: props => { query: props.passedThru } }
 *   )(Component)
 *   <ComponentLoader passedThru="value" />
 *    => <Component query="value" passedThru="value" />
 *
 * Post-load processing of data
 *
 *   let ComponentLoader = LoaderHOC<ResultType>(
 *       url,
 *       { serverAdapter: data => Object.assign({}, data, { addedProp: `value of foo: ${data.foo}` }) }
 *   )(Component)
 *   <ComponentLoader id={id} />
 *    => <Component id={id} data=[...] addedProp="value of foo: bar" />
 *
 * Usage with React-Router
 *
 *   let RouteLoader = LoaderHOC<ResultType, RouteComponentProps<RouteParams>>(
 *       url,
 *       { getApiQuery: props => ({ id: props.match.params.id }) }
 *   )(Component)
 *   <Route path={pathName + '/:id'} component={RouteLoader}/>
 *    => <Component match={...} history={...} location={...} id={id} data=[...] />
 *
 * Modifying the record
 *
 *   By its nature, a Loader component only performs GET requests. However, the resulting component may make alterations
 *   to the model on the server. In this case, any time a model is altered, the component should call a special prop
 *   called onServerChange. The loader will then reload the data.
 *
 * onMessage and onError
 *
 *   By default, Loader components display their own errors in case of a server error. However, by including an onError
 *   property, you can customize this display. The resulting component will also have this callback available to it.
 *
 *     <ComponentLoader onError={errorMessage => doSomething(errorMessage)} />
 *
 *   You can also provide an onMessage callback, which is simply passed through. You do not have to specify it as a
 *   passthrough property in the type arguments.
 *
 *     <ComponentLoader onMessage={message => doSomething(message)} />
 *
 *
 */

let defaultServerAdapter = (x: any) => x;
let defaultRenderError: (text: React.ReactChild) => JSX.Element =
    text => (
        <div>[ warning ]<div>{text}</div></div>
    );
let defaultRenderLoader: () => JSX.Element = () => <div>Loading&hellip;</div>;

export function configureDefaults(options: {
    serverAdapter?: (response: any) => any,
    renderError?(text: React.ReactChild): JSX.Element,
    renderLoader?(): JSX.Element
}) {
    if (options.serverAdapter) {
        defaultServerAdapter = options.serverAdapter;
    }
    if (options.renderError) {
        defaultRenderError = options.renderError;
    }
    if (options.renderLoader) {
        defaultRenderLoader = options.renderLoader;
    }
}

export default function LoaderHOC<
            ResultType,
            PassthruProps = {},
            ApiParams extends {} = DefaultApiParams
>(
    apiUrl: string,
    options: {
        serverAdapter?: (response: any) => ResultType,
        getApiQuery?: (params: PassthruProps & ApiQueryShorthand<ApiParams>) => ApiParams,
        getUrlParams?: (params: Readonly<PassthruProps & ApiQueryShorthand<ApiParams>>) => any,
        renderOnEmptyResult?: true,
        renderError?(text: React.ReactChild): React.ElementType,
        renderLoader?(): React.ElementType
    } = {}
) {
    type BaseProps = PassthruProps & ServerHooks & { onServerChange?(): any, onLoad?(): any };
    type RendererProps = BaseProps & ApiParams;
    type InnerProps = BaseProps & ApiQueryShorthand<ApiParams>;
    type InnerState = { data?: ResultType; errorStatus?: string; }
    type OutputType = { data: ResultType };
    type ElementType = React.ElementType<RendererProps & OutputType>;

    const serverAdapter: (response: any) => ResultType =
        options.serverAdapter || (x => x);
    const getApiQuery: <T extends Readonly<InnerProps>>(props: T) => T extends {apiQuery: ApiParams} ? ApiParams : DefaultApiParams =
        options.getApiQuery || (({id, apiQuery}: any) => apiQuery ? apiQuery : { id });
    const getUrlParams = options.getUrlParams || (() => ({}));
    const renderError = options.renderError || defaultRenderError;
    const renderLoader = options.renderLoader || defaultRenderLoader;

    return function<T extends ElementType>(Display: T) {
        return class extends React.Component<InnerProps, InnerState> {
            state: InnerState = {};
            componentWillMount() {
                this.load(this.props);
            }
            componentWillReceiveProps(next: Readonly<InnerProps>) {
                if (
                    !deepCompare.apply(null, [this.props, next].map(getApiQuery)) ||
                    !deepCompare.apply(null, [this.props, next].map(getUrlParams))
                ) {
                    // console.log('api query changed');
                    this.setState({ data: null });
                    this.load(next);
                }
            }
            load(props: Readonly<InnerProps> = this.props) {
                const {onError} = props;
                const computedApiQuery = getApiQuery(props);
                const computedUrl = generatePath(apiUrl, getUrlParams(props));

                let promise = JsonApi.get(computedUrl, computedApiQuery).then(
                    response => this.setState({
                        data: serverAdapter? serverAdapter(response) : response
                    }),
                    errorStatus => {
                        if (onError) {
                            if (onError(errorStatus) !== false) {
                                this.setState({errorStatus});
                            }
                        } else {
                            this.setState({errorStatus});
                        }
                    }
                );
                if (this.props.onLoad) {
                    promise.then(this.props.onLoad)
                }
            }
            onServerChange = (clearData?: boolean) => {
                if (clearData) {
                    this.setState({ data: null })
                }
                this.load();
                this.props.onServerChange && this.props.onServerChange();
            };
            render() {
                const {data, errorStatus} = this.state;

                if (data) {
                    if (Array.isArray(data) && data.length == 0 && !options.renderOnEmptyResult) {
                        return renderError('No results');
                    }

                    // See this issue for why "any" is necessary here:
                    // https://github.com/Microsoft/TypeScript/issues/10727
                    const {apiQuery, id, onServerChange, children, ...innerProps} = this.props as any;

                    return React.createElement(
                        Display,
                        {
                            data: data,
                            ...getApiQuery(this.props),
                            ...innerProps,
                            onServerChange: this.onServerChange
                        }
                    );
                }
                if (errorStatus) {
                    return renderError(errorStatus);
                }
                return renderLoader();
            }
        }
    }
}

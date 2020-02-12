# react-ferrier

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/cfe-lab/react-ferrier/blob/master/LICENSE)

**React Ferrier** is a collection of utilities for connecting React interfaces to a RESTful API.

While not necessary, it also works well with React Router.

## JsonApi

* Respects the `Location` header
* Handles error responses. Expects errors in the format `{"error": "[error message]"}`, but degrades gracefully if a non-JSON response (e.g. a plain string) is received.
* [optional] Use the `routeWith` parameter to enable server redirects. In this mode, server messages and errors are stored in history's invisible state object.

Basic usage:

    JsonApi.get('/rest-resource/101', {parameter: 'value'}).then(resp => {
        // response is interpreted as JSON
        callback(response);
    }).catch(error => {
        errorCallback(error);
    });

JsonApi handles HTTP requests, including `GET`, `POST`, `PATCH`, `PUT`, `DELETE`, `LINK`, and `UNLINK`.

    JsonApi.get
    JsonApi.post
    JsonApi.put
    JsonApi.patch
    JsonApi.delete
    JsonApi.link
    JsonApi.unlink

`GET` requests will have their parameters URL-encoded and appended to the 
endpoint. All other requests will have their parameters sent as JSON in the
request body. 

Provide a history handle if you want the HTTP `Location` header to be followed.
Since you may be navigated away from the current page, the server response will
be recorded in `history.state` with the key `serverMessage`. If an error occurs,
it will be recorded with the key `errorMessage`.
    
    import {createBrowserHistory} from 'history';
    let history = createBrowserHistory();
    JsonApi.get('/rest-resource/101', {}, {routeWith: history});

You may cancel an API request before it finishes.

    let handle = JsonApi.get('/rest-resource/101');
    handle.cancel();
    // JsonApi request is halted

For debugging purposes, you can enable logging.

    import {enableLogging, disableLogging} from 'react-ferrier/json-api'
    
    enableLogging(); // send debugging messages to console.log
    disableLogging(); // cancel debugging messages
    
    function customLogger(message) {
        window.alert(message);
    }
    enableLogging(customLogger); // send debugging messages to customLogger 

## LoaderHOC

LoaderHOC is a React higher-order-component for fetching an HTTP resource and displaying it to the user. All you need are the resource URL and the React display component.

Basic usage

    let ComponentLoader = LoaderHOC<ResultType>(url)(Component);
    <ComponentLoader id={id} />
     => <Component id={id} data=[...] />

You may provide your own error display.

    let ComponentLoader = LoaderHOC<ResultType>(url, {
        renderError(message) {
            return <MyMessageComponent>{ message }</MyMessageComponent>
        }
    })(Component);
    
    <ComponentLoader id={id} /> // server returns error or empty set
     => <MyMessageComponent>Server Error</MyMessageComponent>

You may provide your own custom loading indicator.

    let ComponentLoader = LoaderHOC<ResultType>(url, {
        renderLoader() {
            return <MySpinnyWheel/>
        }
    })(Component);
    
    <ComponentLoader id={id} />  
     => <MySpinnyWheel/> // while waiting for server response

An empty array response will result in an error message.

Passing props through the loader

    let ComponentLoader = LoaderHOC<ResultType, { passedThru: any }>(url)(Component);
    <ComponentLoader id={id} passedThru={{ foo: 'bar' }} />
     => <Component id={id} data=[...] passedThru={{ foo: 'bar' }} />

Setting API request parameters

    let ComponentLoader = LoaderHOC<ResultType, {}, { id: number, apiFlag: boolean }>(url)(Component)
    <ComponentLoader apiQuery={{ id: 1, apiFlag: true }} />
     => <Component id={1} apiFlag={true} />

Custom API parameter computation

    let ComponentLoader = LoaderHOC<ResultType, { passedThru: string }>(
        url,
        { 
            getApiQuery(props) {
                return { query: props.passedThru }
            }
        }
    )(Component)
    
    <ComponentLoader passedThru="value" />
     => <Component query="value" passedThru="value" />

Post-processing of data

    let ComponentLoader = LoaderHOC<ResultType>(
        url,
        { 
            serverAdapter(data) {
                return Object.assign({}, data, { addedProp: `value of foo: ${data.foo}` })
            }
        }
    )(Component)
    
    <ComponentLoader id={id} />
     => <Component id={id} data=[...] addedProp="value of foo: bar" />

Usage with React-Router

    let RouteLoader = LoaderHOC<ResultType, RouteComponentProps<RouteParams>>(
        url,
        {
            getApiQuery(props) {
                return ({ id: props.match.params.id });
            }
        }
    )(Component)
    
    <Route path={pathName + '/:id'} component={RouteLoader}/>
     => <Component match={...} history={...} location={...} id={id} data=[...] />
     
Set application-wide settings using `configureDefaults`

    import {configureDefaults} from 'react-ferrier/loader-hoc'
    
    // Set a global data postprocessor:
    configureDefaults({ 
        serverAdapter(data) {
            return { dataWrapper: data };
        } 
    });
    
    // Set a global display for error messages:
    configureDefaults({ 
        renderError(message) {
            return <MyMessageComponent>{ message }</MyMessageComponent>;
        } 
    });
    
    // Set a global loading indicator:
    configureDefaults({ 
        renderLoader() {
            return <MySpinnyWheel/>;
        } 
    }); 

### Modifying the record

By its nature, a Loader component only performs GET requests. However, the 
resulting component may make alterations to the model on the server. In this 
case, any time a model is altered, the component should call a special prop
called `onServerChange`. The loader will then reload the data.

### onError

Sometimes you will need to know if the server returned an error. In this case, 
provide a callback.
 
    <ComponentLoader onError={errorMessage => doSomething(errorMessage)} />

LoaderHOC will display the error using its renderer. To suppress this, 
explicitly return `false` from the callback.

    <ComponentLoader onError={errorMessage => {
        doSomething(errorMessage);
        return false;
    }} />
    
## @todo

Documentation for ComposerHOC upcoming. In the meantime, comments in the 
source files may be of help. 
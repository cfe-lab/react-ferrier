import * as React from "react";
import {deepCompare, filterNulls, objectDiff} from "./helpers";
import DefaultServerHandler from "./default-server-handler";
import Api from './json-api';
import generatePath from "./generate-path";

let globalServerHandler: ServerHandlerType = DefaultServerHandler;

type DatabaseRecord = { id: number };

export function configureDefaults(options: {
    serverHandler?: ServerHandlerType
}) {
    if (options.serverHandler) {
        globalServerHandler = options.serverHandler;
    }
}

export interface Integration<
    FromServer extends DatabaseRecord,
    WithinClient,
    ExtraFlags = {},
    NewRecord = Optionalize<FromServer, 'id'> & ExtraFlags,
    UpdateRecord = DatabaseRecord & Partial<FromServer & ExtraFlags>
> {
    /**
     * Initial state of a new record for composing.
     */
    defaultState: WithinClient;

    /**
     * Transforms a database record from the server into an object for editing in the client.
     * @param {FromServer} data A database record, should be minimally augmented or not augmented if practical.
     * @returns {WithinClient}
     */
    deserialize?(data: FromServer): WithinClient;

    /**
     * Transforms a client object into a package of data for the server to save to database. Type ToServer differs from
     * FromServer in that a new record will not yet have an id field, and may include extraneous fields which the server
     * will process (see: file uploads). ToServer may be anything, but defaults to the preceding description.
     * @param {WithinClient} data
     * @returns {ToServer}
     */
    serialize(data: WithinClient): NewRecord|Promise<NewRecord>;

    primaryKey?: keyof FromServer;

    getUrlParams?(data: Partial<FromServer & ExtraFlags>): any;

    serverHandler?: ServerHandlerType
}


type ComposerProps<T, ExtraProps> = ExtraProps & {
    existingObject?: T;
    defaultValue?: T;

    /**
     * Optional callback to call when the composer successfully creates a new record
     * @param {CustomEvent} e An event object with the following two detail parameters:
     *      {string} serverMessage The server's response.
     *      {number} newId An ID number for the new record, if provided.
     */
    onSuccess?(e: CustomEvent<SubmitEventInfo>): void

    /**
     * Optional callback to call when the composer receives an error from the server.
     * @param {CustomEvent} e An event object with the following detail parameter:
     *      {string} errorMessage The server's response.
     */
    onError?(e: CustomEvent<{errorMessage: string}>): void
}

type RendererProps<T, U, ExtraProps> =
    ComposerProps<T, ExtraProps> &
    ServerComms &
    GettersSetters<U> &
    {
        onSubmit(): void;
        isNew: boolean;
    }

type RendererType<T, U, ExtraProps> =
    React.ComponentType<RendererProps<T, U, ExtraProps>>;

type ServerHandlerType =
    React.ComponentType<ServerComms & { clearMessages(): void, id?: number }>;

type SubmitEventInfo = { serverMessage: string, id: number };
const ComposerHOC = <T extends DatabaseRecord, U, ExtraProps extends {} = {}, ExtraFlags = {}>(
    saveUrl: string,
    renderer: RendererType<T, U, ExtraProps>,
    integrationSpec: Integration<T, U, ExtraFlags>
) => {
    type P = ComposerProps<T, ExtraProps>;
    type S = { data: U, newId?: number } & ServerComms;
    const canEdit = integrationSpec.hasOwnProperty('deserialize');
    const primaryKey = integrationSpec.primaryKey || 'id';
    const ServerHandler: ServerHandlerType = integrationSpec.serverHandler || globalServerHandler;

    return class extends React.Component<P, S> implements Integration<T,U,ExtraFlags> {

        defaultState = integrationSpec.defaultState;
        serialize = integrationSpec.serialize;
        deserialize = integrationSpec.deserialize;

        constructor(props: P) {
            super(props);
            const {defaultValue, existingObject} = props;
            if (defaultValue && existingObject) {
                throw new Error('Either a default object or an existing object can be defined, but not both.')
            }
            if (!canEdit && existingObject) {
                throw new Error('This Composer class can only create. It cannot update.')
            }
            this.state = {
                data: Object.assign({},
                    this.defaultState,
                    defaultValue && filterNulls(this.deserialize(defaultValue)),
                    existingObject && this.deserialize(existingObject)
                )
            };
        }

        componentWillReceiveProps(next: P) {
            if (!canEdit && next.existingObject) {
                throw new Error('This Composer class can only create. It cannot update.')
            }
            if (this.props.defaultValue && next.existingObject || this.props.existingObject && next.defaultValue) {
                throw new Error('Either a default object or an existing object can be defined, but not both.');
            }
            if (canEdit && !deepCompare(this.props.defaultValue, next.defaultValue)) {
                this.setState(this.deserialize(next.defaultValue));
            }
            if (canEdit && !deepCompare(this.props.existingObject, next.existingObject)) {
                this.setState(this.deserialize(next.existingObject));
            }
        }

        async buildAttributes(initial: T, updated: U): Promise<Partial<T & ExtraFlags>> {
            const serialized = await this.serialize(updated);
            if (canEdit && initial) {
                // this is an update
                let diff = objectDiff(await this.serialize(this.deserialize(initial)), serialized);
                if (diff[primaryKey as 'id']) {
                    (diff as any)[`updated_${primaryKey}`] = diff[primaryKey as 'id']
                }
                diff[primaryKey as 'id'] = initial[primaryKey as 'id'];
                return diff as Partial<T & ExtraFlags>;
            }
            return serialized;
        }

        async submit() {
            const attributes = await this.buildAttributes(this.props.existingObject, this.state.data);
            const {onSuccess, onError} = this.props;

            if (Object.keys(attributes).length === 1 && attributes.id) {
                this.setState({errorMessage: 'No data has changed'});
                return;
            }

            let url = saveUrl;
            if (integrationSpec.getUrlParams) {
                let existingParams = this.isNew() ? {} :
                    integrationSpec.deserialize(this.props.existingObject);
                url = generatePath(url, integrationSpec.getUrlParams(existingParams));
            }
            let request = this.apiRequest(url, attributes);

            return request.then(
                ({message: serverMessage, id, redirectTo}) => {
                    const e = new CustomEvent('submit', {detail: {serverMessage, id}});
                    onSuccess && onSuccess(e);
                    if (!e.defaultPrevented) {
                        if (redirectTo) {
                            this.setState({ redirectTo, serverMessage });
                        } else {
                            this.setState({ serverMessage });
                        }
                    }
                },
                errorMessage => {
                    const e = new CustomEvent('submit', {detail: {errorMessage}});
                    onError && onError(e);
                    if (!e.defaultPrevented) {
                        this.setState({errorMessage})
                    }
                }
            )
        }

        setData<K extends keyof U>(update: Pick<U, K>) {
            this.setState({
                data: Object.assign({}, this.state.data, update)
            })
        }

        apiRequest(url: string, data?: any) {
            return this.isNew() ?
                Api.post(url, data) :
                Api.patch(url, data);
        }

        isNew() {
            return !this.props.existingObject;
        }

        render() {
            const {props, state} = this;
            const Renderer = renderer;
            return (
                <>
                    <ServerHandler
                        clearMessages={() => this.setState({errorMessage: null, serverMessage: null})}
                        serverMessage={state.serverMessage}
                        errorMessage={state.errorMessage}
                        redirectTo={state.redirectTo}
                    />
                    <Renderer {...(props as any)}
                        isNew={this.isNew()}
                        get={state.data}
                        set={(key: keyof U) => (value: any) => this.setData({[key]: value} as any)}
                        onSubmit={() => this.submit()}
                    />
                </>
            );
        }

    };
};

export default ComposerHOC;
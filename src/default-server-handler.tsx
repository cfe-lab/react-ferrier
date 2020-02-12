import * as React from 'react';
import {urlFor} from "./urlFor";

export default (props => {
    const redirect = props.redirectTo &&
        <div><a href={urlFor(props.redirectTo)}>Continue</a></div>;
    return (
        <div>
            {
                props.errorMessage &&
                <div style={{whiteSpace: 'pre-wrap'}}>
                    <a onClick={props.clearMessages}>[ x ]</a>
                    {props.errorMessage}
                    {redirect}
                </div>
            }
            {
                props.serverMessage &&
                <div style={{whiteSpace: 'pre-wrap'}}>
                    <a onClick={props.clearMessages}>[ x ]</a>
                    {props.serverMessage}
                    {redirect}
                </div>
            }
        </div>
    )
}) as React.FC<ServerComms & { clearMessages: () => void, id?: number }>;
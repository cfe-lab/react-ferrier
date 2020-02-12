
// helper for objectValues
function getObjKeys<T>(obj: T): (keyof T)[] {
    let keys = Object.keys(obj) as (keyof T)[];
    if (obj instanceof File) {
        // don't bother with lastModified
        keys = keys.concat('name' as keyof T);
    }
    if (obj instanceof Blob) {
        keys = keys.concat(['size', 'type'] as any[]);
    }
    return keys;
}
/**
 * Compares objects with deep equality checking
 *
 * Handles File objects by comparing name, size, and mime type. Does not check contents or last-modified.
 *
 * @param i1 the first operand
 * @param i2 the second operand
 * @returns true if the objects are identical, even if they are at different memory addresses, otherwise false
 */
export function deepCompare<T>(i1: any, i2: any): boolean {
    type BinaryOp = (cb: (input: any) => boolean) => boolean;
    const both: BinaryOp = [].every.bind([i1,i2]);
    const either: BinaryOp = [].some.bind([i1,i2]);
    // for whatever reason, NaN !== NaN...
    if (both(i => typeof i == 'number') && both(isNaN)) return true;
    if (!both(i => typeof i === 'object') || either(i => i === null))
        return i1 === i2; // cheap way in case the deep comparison is unnecessary...
    let keys = getObjKeys(i1);
    if (keys.length !== getObjKeys(i2).length) {
        return false;
    }
    for (let prop of keys) {
        if (typeof i1[prop] == 'object' && i1[prop] !== null) {
            if (!deepCompare(i1[prop], i2[prop])) {
                return false;
            }
        } else if (i1[prop] !== i2[prop]) {
            return false;
        }
    }
    return true;
}

export function filterNulls<T, K extends keyof T>(obj: T): Pick<T,K> {
    let newObj: Pick<T,any> = {};
    for (let key in obj) if (obj.hasOwnProperty(key)) {
        if (obj[key] !== null) {
            newObj[key] = obj[key];
        }
    }
    return newObj as Pick<T,K>;
}

/**
 * Simple object key-value difference.
 * For each key in either the left or right object, return the values of the right object where the value differs.
 * Compares deeply - but doesn't diff deeply.
 * If key is present in only one object, it is treated as { [key]: undefined } in the other object
 *
 * @param lhs left-hand side
 * @param rhs right-hand side
 */
export function objectDiff<T1, T2, K extends keyof (T1&T2) = keyof (T1&T2)>(lhs: T1, rhs: T2): Partial<T2> {
    type IntersectionKeys = (keyof T1 & keyof T2);
    let newObj: Partial<T1|T2> = {};
    for (let key in lhs) if (lhs.hasOwnProperty(key)) {
        let key_: IntersectionKeys = key as any;
        if (!deepCompare(lhs[key_], rhs[key_])
            && !(lhs[key_] === null && rhs[key_] === undefined)
            && !(lhs[key_] === undefined && rhs[key_] === null)
        ) {
            newObj[key_] = rhs[key_]
        }
    }
    for (let key in rhs) if (rhs && rhs.hasOwnProperty(key) && !(lhs && lhs.hasOwnProperty(key))) {
        let key_: IntersectionKeys = key as any;
        newObj[key_] = rhs[key_]
    }
    return newObj as Partial<T2>;

}

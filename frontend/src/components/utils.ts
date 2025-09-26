import {useEffect, useRef} from "react";

let API_BASE_URL = 'http://localhost:8080';

export function getURI(endpoint: string, parameters: { [key: string]: string | number  }) {

    const parameters_empty = Object.keys(parameters).length === 0;

    const encoded_parameters = !parameters_empty ? Object.keys(parameters)
        .map((key) => `${key}=${encodeURIComponent(parameters[key])}`)
        .reduce((a, b) => a + "&" + b) : ''

    return !parameters_empty ? API_BASE_URL + endpoint + "?" + encoded_parameters : API_BASE_URL + endpoint;
}

export function translateQueryName(name: string){
    switch(name) {
        case "directlyFollowsEdge" : {
            return "isDirectlyFollowed";
        }
        case "eventuallyFollowsEdge" : {
            return "isEventuallyFollowed";
        }
    }
}

export function translateEdgeName(name: string) {
    switch(name) {
        case "isDirectlyFollowed" : {
            return "directlyFollowsEdge";
        }
        case "isEventuallyFollowed" : {
            return "eventuallyFollowsEdge";
        }
    }
    return name;
}

export function extractPContent(beforeContent: string, pOperator: string, p: number, pMode: string) {
    switch(beforeContent) {
        case "Event":
        case "containsObjectsOfType":
        case "containsObjects": {
            return "None";
        }
        default: {
            if (pMode === "relative")
                return translateGTE(pOperator) + " " + (p*100).toFixed(1) + "%";
            else
                return translateGTE(pOperator) + " " + p;
        }
    }
}

export function extractBeforeContent(beforeContent: string, nOperator: string, n: number) {
    switch(beforeContent) {
        case "isStart": {
            return "INIT";
        }
        case "isEnd": {
            return "END";
        }
        case "Event":
        case "containsObjects": {
            return "None";
        }
        default: {
            return translateGTE(nOperator) + " " + n;
        }
    }
}

export function extractPerfContent(metric: string, operator: string, value: any) {
    if (metric !== "" && metric !== "timestamp")
        return metric + " " + translateGTE(operator) + " " + secondsToHumanReadableFormat(value, 4);
    if (metric === "timestamp")
        return metric + " " + translateGTE(operator) + " " + new Date(value*1000).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return "";
}

export function translateGTE (nOperator: string) {
    switch(nOperator){
        case "gte": {
            return "≥"
        }
        case "lte": {
            return "≤"
        }
        case "eq": {
            return "="
        }
    }
    return ""
}

export const useDelayedExecution = (func: (() => void), delay: number, executeBeforeUnmount: boolean = false) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                if (executeBeforeUnmount)
                    func()
                clearTimeout(timeoutRef.current);
            }
        }
    }, []);

    const cancel = () => {
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
    }

    const execute = () => {
        cancel();
        timeoutRef.current = setTimeout(func, delay);
    }

    return { execute, cancel }
}

export function secondsToHumanReadableFormat(seconds: number | string, accuracy: number = -1): string {
    function handleTimestep(remainingTime: number, factor: number, unit: string, parts: string[]): [number, string[]] {
        const count = Math.floor(remainingTime / factor)
        if (parts.length > 0 || count > 0)
            parts = parts.concat([`${count}${unit}`])
        return [remainingTime - count * factor, parts]
    }
    if (typeof seconds === "string")
        return seconds;

    let parts: string[] = [];
    let remaining = seconds;
    [remaining, parts] = handleTimestep(remaining, 24 * 60 * 60, "d", parts);
    [remaining, parts] = handleTimestep(remaining, 60 * 60, "h", parts);
    [remaining, parts] = handleTimestep(remaining, 60, "m", parts);
    parts.push(`${Math.round(remaining)}s`);

    if (accuracy > 0 && accuracy < parts.length)
        parts = parts.slice(0, accuracy);

    return parts.reduce((a, b) => a + " " + b);
}

function generateColors(numColors: number, colorIndex: number) {
    let h = colorIndex / numColors;
    let i = ~~(h * 6);
    let f = h * 6 - i;
    let q = 1 - f;

    let r, g, b;
    switch(i % 6){
        case 0: r = 1; g = f; b = 0; break;
        case 1: r = q; g = 1; b = 0; break;
        case 2: r = 0; g = 1; b = f; break;
        case 3: r = 0; g = q; b = 1; break;
        case 4: r = f; g = 0; b = 1; break;
        case 5: r = 1; g = 0; b = q; break;
        default: r = 0; g = 0; b = 0; break; // to make typescript happy and avoid r,g,b "possibly" being undefined
    }

    return "#" + ("00" + (~~(r * 255)).toString(16)).slice(-2) + ("00" + (~~(g * 255)).toString(16)).slice(-2) + ("00" + (~~(b * 255)).toString(16)).slice(-2);
}

// Either choose from preselected set of colors or generate an arbitrary amount of colors if not enough were preselected.
// Note that we cannot mix these two approaches and give back preselected colors until we don't have enough and then use
// the color generation as we currently can't make sure we don't generate a color that's identical (or too close) to a
// preselected (and already returned and therefore used) color.
export function getObjectTypeColor(numberOfColorsNeeded: number, indexOfCurrentColor: number) {
    console.assert(indexOfCurrentColor >= 0 && indexOfCurrentColor < numberOfColorsNeeded);

    return generateColors(numberOfColorsNeeded, indexOfCurrentColor);
}

export async function getPECount() {
    const potFilePath = localStorage.getItem('ocel');
    const filePath = potFilePath? potFilePath : "";
    const uri = getURI("/logs/process_execution_count", {file_path: filePath});
    let results: number = -1
    await fetch(uri)
        .then((response) => response.json())
        .then((result: number) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}
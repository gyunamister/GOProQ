import cytoscape from 'cytoscape';
import elk from 'cytoscape-elk';

// You cannot import these modules from TypeScript, so needs to be in JavaScript.
export function init_cyto() {
    cytoscape.use( elk );
}

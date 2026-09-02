import { QueryNavegationalError } from "./queryErrors";

export interface GraphQuery {
    edges: [string, string, string, boolean][];
    vars: string[];
}

export async function graphQuery(q: GraphQuery) {
    if (q.vars.length === 0) throw new Error("No variables selected for query.");
    const vars = [...new Set(q.vars)];
    const matches: string[] = [];
    const wheres: string[] = [];
    const varTypes = new Map<string, "node" | "edge">();

    console.log("Graph edges:", q.edges);
    console.log("Graph variables:", vars);

    const escapeStr = (str: string) => str.replace(/'/g, "\\'");
    const cleanVar = (v: string) => v.startsWith("?") ? v.slice(1) : v;

    q.edges.forEach(([src, lbl, dst, bidirectional], i) => {
        let srcVar: string, dstVar: string;

        if (src.startsWith("?")) {
            srcVar = `v_${cleanVar(src)}`;
            varTypes.set(src, "node");
        } else {
            srcVar = `n_src_${i}`;
            wheres.push(`${srcVar}.name = '${escapeStr(src)}'`);
        }

        if (dst.startsWith("?")) {
            dstVar = `v_${cleanVar(dst)}`;
            varTypes.set(dst, "node");
        } else {
            dstVar = `n_dst_${i}`;
            wheres.push(`${dstVar}.name = '${escapeStr(dst)}'`);
        }

        if (lbl.startsWith("?")) { // Variables cannot have path expressions
            const relVar = `e_${cleanVar(lbl)}`;
            varTypes.set(lbl, "edge");
            if (bidirectional) {
                matches.push(`MATCH (${srcVar}:Node)-[${relVar}]-(${dstVar}:Node)`);
            } else {
                matches.push(`MATCH (${srcVar}:Node)-[${relVar}]->(${dstVar}:Node)`);
            }
        } else {
            const tokens = lbl.trim().split(/\s+/);
            
            let pathPattern = `(${srcVar}:Node)`;
            const arrow = bidirectional ? "-" : "->";
            tokens.forEach((token, k) => {
                const isLastToken = k === tokens.length - 1;
                const currentDst = isLastToken ? `(${dstVar}:Node)` : '()';
                const match = token.match(/^([A-Za-z0-9_\|]+)(\*)?(?:\^(\d+))?$/);
                if (!match) {
                    if (/[*^|]/.test(token)) {
                        throw new QueryNavegationalError(`Invalid path expression in label: ${lbl}.`, lbl);
                    }
                    pathPattern += `-[:\`${escapeStr(token)}\`]${arrow}${currentDst}`;
                } else {
                    const baseTypes = match[1];
                    const isStar = !!match[2];
                    const nth = match[3];

                    if (baseTypes.startsWith('|') || baseTypes.endsWith('|') || baseTypes.includes('||')) {
                        throw new QueryNavegationalError(`Invalid path expression in label: ${lbl}.`, lbl);
                    }
                    
                    const cypherTypes = baseTypes.split('|').map(t => `\`${escapeStr(t)}\``).join('|');
                    let quant = "";
                    if (isStar) quant = "*0..";
                    else if (nth) quant = `*${nth}`;
                    
                    pathPattern += `-[:${cypherTypes}${quant}]${arrow}${currentDst}`;
                }
            });
            matches.push(`MATCH ${pathPattern}`);
        }
    });
    vars.forEach(v => {
        if (!varTypes.has(v)) {
            varTypes.set(v, "node");
            matches.push(`MATCH (v_${cleanVar(v)}:Node)`);
        }
    });
    const returns = vars.map(v => {
        const type = varTypes.get(v);
        const cName = cleanVar(v);
        
        if (type === "node") {
            const name = `v_${cName}.name AS \`${v}\``;
            const id = `v_${cName}.id AS \`$${v}\``;
            return [name, id].join(", ")
        } else {
            const name = `type(e_${cName}) AS \`${v}\``;
            const id = `e_${cName}.id AS \`$${v}\``;
            return [name, id].join(", ");
        }
    });
    const queryParts: string[] = [];
    if (matches.length > 0) {
        queryParts.push(matches.join("\n"));
    }  
    if (wheres.length > 0) {
        queryParts.push(`WHERE ${wheres.join(" AND ")}`);
    }
    queryParts.push(`RETURN DISTINCT ${returns.join(", ")}`);
    return queryParts.join("\n");
}

export class Query {
    query: string;
    vars: string[];

    constructor(query: string, vars: string[]) {
        this.query = query;
        this.vars = vars;
    }
}
export const Operator = {
    UNION: union,
    DIFFERENCE: difference,
    INTERSECT: intersection,
    JOIN: join,
    OPTIONAL: leftJoin,
    MINUS: antiJoin
} as const;
export type Operator = keyof typeof Operator;

function unionVars(v1: string[], v2: string[]): string[] { 
    return [...new Set([...v1, ...v2].sort())];
}

function intersectVars(v1: string[], v2: string[]): string[] {
    return v1.filter(v => v2.includes(v)).sort();
}

function equivalentVars(v1: string[], v2: string[]): boolean {
    return unionVars(v1, v2).length === intersectVars(v1, v2).length;
}

export function union(q1: Query, q2: Query): Query {
    if (!equivalentVars(q1.vars, q2.vars)) {
        throw new Error("Cannot union queries with different variables.");
    }
    const vars = q1.vars;
    const returns = vars.map(v => `\`${v}\``).join(", ");
    const cypher = `
        CALL { ${q1.query} }
        RETURN ${returns}
        UNION
        CALL { ${q2.query} }
        RETURN ${returns}
    `.trim();
    return new Query(cypher, vars);
}

export function difference(q1: Query, q2: Query): Query {
    if (!equivalentVars(q1.vars, q2.vars)) {
        throw new Error("Cannot difference queries with different variables.");
    }
    const vars = q1.vars;
    const mapStructure = vars.map(v => `\`${v}\`: \`${v}\``).join(", ");
    const cypher = `
        CALL { ${q2.query} }
        WITH collect({ ${mapStructure} }) AS R_results
        CALL { ${q1.query} }
        WITH R_results, { ${mapStructure} } AS L_row
        WHERE NOT L_row IN R_results
        RETURN ${vars.map(v => `L_row.\`${v}\` AS \`${v}\``).join(", ")}
    `.trim();
    return new Query(cypher, vars);
}

export function intersection(q1: Query, q2: Query): Query {
    if (!equivalentVars(q1.vars, q2.vars)) {
        throw new Error("Cannot intersect queries with different variables.");
    }
    const vars = q1.vars;
    const mapStructure = vars.map(v => `\`${v}\`: \`${v}\``).join(", ");
    const cypher = `
        CALL { ${q2.query} }
        WITH collect({ ${mapStructure} }) AS R_results
        CALL { ${q1.query} }
        WITH R_results, { ${mapStructure} } AS L_row
        WHERE L_row IN R_results
        RETURN ${vars.map(v => `L_row.\`${v}\` AS \`${v}\``).join(", ")}
    `.trim();
    return new Query(cypher, vars);
}

export function join(q1: Query, q2: Query): Query {
    const vars = unionVars(q1.vars, q2.vars);
    const cons = intersectVars(q1.vars, q2.vars);

    const L_map = q1.vars.map(v => `\`${v}\`: \`${v}\``).join(", ");
    const R_map = q2.vars.map(v => `\`${v}\`: \`${v}\``).join(", ");

    const onClause = cons.length 
        ? cons.map(v => `L_row.\`${v}\` = R_row.\`${v}\``).join(" AND ")
        : "true";

    const returns = vars.map(v => {
        if (q1.vars.includes(v)) {
            return `L_row.\`${v}\` AS \`${v}\``;
        } else {
            return `R_row.\`${v}\` AS \`${v}\``;
        }
    }).join(", ");

    const cypher = `
        CALL { ${q1.query} }
        WITH collect({ ${L_map} }) AS L_results
        CALL { ${q2.query} }
        WITH L_results, collect({ ${R_map} }) AS R_results
        UNWIND L_results AS L_row
        UNWIND R_results AS R_row
        WITH L_row, R_row
        WHERE ${onClause}
        RETURN ${returns}
    `.trim();
    return new Query(cypher, vars);
}

export function leftJoin(q1: Query, q2: Query): Query {
    const vars = unionVars(q1.vars, q2.vars);
    const cons = intersectVars(q1.vars, q2.vars);

    const L_map = q1.vars.map(v => `\`${v}\`: \`${v}\``).join(", ");
    const R_map = q2.vars.map(v => `\`${v}\`: \`${v}\``).join(", ");

    const onClause = cons.length 
        ? cons.map(v => `R_row.\`${v}\` = L_row.\`${v}\``).join(" AND ")
        : "true";

    const returns = vars.map(v => {
        if (q1.vars.includes(v) && q2.vars.includes(v)) {
            return `COALESCE(L_row.\`${v}\`, R_row.\`${v}\`) AS \`${v}\``;
        } else if (q1.vars.includes(v)) {
            return `L_row.\`${v}\` AS \`${v}\``;
        } else {
            return `R_row.\`${v}\` AS \`${v}\``;
        }
    }).join(", ");

    const cypher = `
        CALL { ${q1.query} }
        WITH collect({ ${L_map} }) AS L_results
        CALL { ${q2.query} }
        WITH L_results, collect({ ${R_map} }) AS R_results
        UNWIND L_results AS L_row
        WITH L_row, [R_row IN R_results WHERE ${onClause}] AS matched_R
        WITH L_row, CASE WHEN size(matched_R) = 0 THEN [null] ELSE matched_R END AS matched_R_safe
        UNWIND matched_R_safe AS R_row
        RETURN ${returns}
    `.trim();
    return new Query(cypher, vars);
}

export function antiJoin(q1: Query, q2: Query): Query {
    const vars = q1.vars;
    const cons = intersectVars(q1.vars, q2.vars);

    const L_map = q1.vars.map(v => `\`${v}\`: \`${v}\``).join(", ");
    const R_map = q2.vars.map(v => `\`${v}\`: \`${v}\``).join(", ");

    const onClause = cons.length 
        ? cons.map(v => `R_row.\`${v}\` = L_row.\`${v}\``).join(" AND ")
        : "true";

    const returns = vars.map(v => `L_row.\`${v}\` AS \`${v}\``).join(", ");

    const cypher = `
        CALL { ${q1.query} }
        WITH collect({ ${L_map} }) AS L_results
        CALL { ${q2.query} }
        WITH L_results, collect({ ${R_map} }) AS R_results
        UNWIND L_results AS L_row
        WITH L_row, [R_row IN R_results WHERE ${onClause}] AS matched_R
        WHERE size(matched_R) = 0
        RETURN ${returns}
    `.trim();
    return new Query(cypher, vars);
}
import { QueryGraph } from "@/graph/Graph";
import showToast from "@/utils/toast";
import { Query, Operator } from "@/db/queryFunctions";
import type GraphDB from "@/db/db";

export interface MultiGraph {
    id: string;
    name: string;
    source: QueryGraph;
}

export type FormulaNode = GraphRefNode | OperatorNode;

export interface GraphRefNode {
    kind: "graph";
    name: string;
}

export interface OperatorNode {
    kind: "operator";
    operator: Operator;
    left: FormulaNode;
    right: FormulaNode;
}

const OPERATOR_SET = new Set<Operator>(Object.keys(Operator) as Operator[]);

function isAllowedOperator(token: string): token is Operator {
    return OPERATOR_SET.has(token as Operator);
}

function tokenize(formula: string): string[] {
    const tokens: string[] = [];
    let current = "";

    const pushCurrent = () => {
        const value = current.trim();
        if (value) tokens.push(value);
        current = "";
    };

    for (const ch of formula) {
        if (/\s/.test(ch)) {
            pushCurrent();
            continue;
        }

        if (ch === "(" || ch === ")") {
            pushCurrent();
            tokens.push(ch);
            continue;
        }

        current += ch;
    }

    pushCurrent();
    return tokens;
}

const PRECEDENCE: Partial<Record<Operator, number>> = {
    OPTIONAL: 2,
    JOIN: 2,
    DIFFERENCE: 1,
    MINUS: 1,
    INTERSECT: 1,
    UNION: 1
};

function getPrecedence(operator: Operator): number {
    return PRECEDENCE[operator] ?? 0;
}

function buildAstFromTokens(tokens: string[]): FormulaNode {
    const output: FormulaNode[] = [];
    const operators: string[] = [];

    const pushOperator = () => {
        const op = operators.pop();
        if (!op || op === "(" || !isAllowedOperator(op)) {
            throw new Error(`Invalid operator stack state near: ${op ?? "<empty>"}`);
        }

        const right = output.pop();
        const left = output.pop();

        if (!left || !right) {
            throw new Error(`Operator ${op} is missing an operand.`);
        }

        output.push({
            kind: "operator",
            operator: op,
            left,
            right,
        });
    };

    for (const token of tokens) {
        if (token === "(") {
            operators.push(token);
            continue;
        }

        if (token === ")") {
            while (operators.length > 0 && operators[operators.length - 1] !== "(") {
                pushOperator();
            }

            if (operators.pop() !== "(") {
                throw new Error("Unmatched closing parenthesis.");
            }
            continue;
        }

        if (isAllowedOperator(token)) {
            while (operators.length > 0) {
                const top = operators[operators.length - 1];
                if (!isAllowedOperator(top)) break;
                if (getPrecedence(top) < getPrecedence(token)) break;
                pushOperator();
            }

            operators.push(token);
            continue;
        }

        if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(token)) {
            throw new Error(`Invalid token: ${token}`);
        }

        output.push({ kind: "graph", name: token });
    }

    while (operators.length > 0) {
        const op = operators[operators.length - 1];
        if (op === "(") {
            throw new Error("Unmatched opening parenthesis.");
        }
        pushOperator();
    }

    if (output.length !== 1) {
        throw new Error("Formula is incomplete or ambiguous.");
    }

    const node = output[0];
    if (!node) {
        throw new Error("Could not build formula AST.");
    }

    return node;
}

export function parseQueryGraphFormula(formula: string): FormulaNode | null {
    const trimmed = formula.trim();
    if (!trimmed) return null;
    return buildAstFromTokens(tokenize(trimmed));
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function queryRequiredElement<T extends Element>(root: ParentNode, selector: string): T {
    const element = root.querySelector(selector);
    if (!element) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element as T;
}

export default class MultiQueryModule {
    private graphs: MultiGraph[] = [];
    private readonly root: HTMLElement;
    private readonly tableRoot: HTMLDivElement;
    private readonly formulaInput: HTMLInputElement;
    private readonly formulaError: HTMLDivElement;

    private formulaAst: FormulaNode | null = null;

    onInspect: (graph: QueryGraph) => void;

    constructor(root: HTMLElement, onInspect: (graph: QueryGraph) => void) {
        this.root = root;
        this.onInspect = onInspect;

        this.root.classList.add("multi");

        this.tableRoot = queryRequiredElement<HTMLDivElement>(this.root, ".multi__table");
        this.formulaInput = queryRequiredElement<HTMLInputElement>(this.root, ".multi__input");
        this.formulaError = queryRequiredElement<HTMLDivElement>(this.root, ".multi__error");
        this.formulaInput.addEventListener("input", this.handleFormulaInput);

        this.syncFormulaState();
        this.render();
    }

    async queryFormula() {
        if (!this.formulaAst) {
            throw new Error("Invalid formula.");
        }

        const query = await this.buildQueryFromAst(this.formulaAst);
        return query.query;
    }

    setGraphs(graphs: MultiGraph[]): void {
        this.graphs = [...graphs];
        this.render();
    }

    addGraph(graph: MultiGraph): void {
        const nextIndex = this.graphs.length + 1;
        const baseName = graph.name?.trim() || `q${nextIndex}`;

        let name = baseName;
        if (this.graphs.some((g) => g.name === name)) {
            let suffix = 1;
            while (this.graphs.some((g) => g.name === `${baseName}_${suffix}`)) {
                suffix++;
            }
            name = `${baseName}_${suffix}`;
        }

        this.graphs.push({
            id: graph.id,
            name,
            source: graph.source,
        });

        this.render();
    }

    getFormulaAst(): FormulaNode | null {
        return this.formulaAst;
    }

    getGraphs(): MultiGraph[] {
        return this.graphs;
    }

    hide(): void {
        this.root.hidden = true;
    }

    show(): void {
        this.root.hidden = false;
    }

    onDelete(graph: MultiGraph): void {
        const index = this.graphs.findIndex((g) => g.id === graph.id);
        if (index !== -1) {
            this.graphs.splice(index, 1);
            this.render();
        }
    }

    onRename(graph: MultiGraph, newName: string): void {
        graph.name = newName;
    }

    serialize() {
        return {
            mode: "Multi",
            graphs: this.graphs.map((g) => ({
                id: g.id,
                name: g.name,
                source: g.source.serialize(),
            })),
            formula: this.formulaInput.value,
        };
    }

    deserialize(data: any, graphDB: GraphDB | null): void {
        if (!data || typeof data !== "object") {
            throw new Error("Invalid data for deserialization.");
        }

        const payload = data as {
            mode: string;
            graphs: Array<{ id: string; name: string; source: unknown }>;
            formula: string;
        };

        if (payload.mode !== "Multi") {
            throw new Error(`Attempted to load ${data.mode} graph when expected Multi graph.`);
        }

        this.graphs = payload.graphs.map((g) => ({
                    id: g.id,
                    name: g.name,
                    source: QueryGraph.deserialize(g.source as any, graphDB) as QueryGraph,
                }));

        this.formulaInput.value = payload.formula ?? "";
        this.syncFormulaState();
        this.render();
    }

    private handleFormulaInput = (): void => {
        this.syncFormulaState();
    };

    private syncFormulaState(): void {
        try {
            this.formulaAst = parseQueryGraphFormula(this.formulaInput.value);
            this.setFormulaError("");
        } catch (error) {
            this.formulaAst = null;
            this.setFormulaError(getErrorMessage(error));
        }
    }

    private setFormulaError(message: string): void {
        this.formulaError.textContent = message;
        this.formulaError.hidden = !message;
    }

    private validateGraphName(candidate: string, currentId: string): string {
        const name = candidate.replace(/\s+/g, "");

        if (!name) {
            throw new Error("Graph name cannot be empty.");
        }

        if (isAllowedOperator(name)) {
            throw new Error(`Graph name cannot be an operator (${name}).`);
        }

        if (!/^[A-Za-z_][A-Za-z0-9_\-]*$/.test(name)) {
            throw new Error(`Graph name "${name}" is invalid.`);
        }

        if (this.graphs.some((g) => g.id !== currentId && g.name === name)) {
            throw new Error(`Graph name "${name}" is already in use.`);
        }

        return name;
    }

    private async buildQueryFromAst(node: FormulaNode): Promise<Query> {
        if (node.kind === "graph") {
            const graph = this.graphs.find((g) => g.name === node.name);
            if (!graph) {
                throw new Error(`Graph "${node.name}" not found.`);
            }

            try {
                const query = await graph.source.query();
                return new Query(query, graph.source.getSelected());
            } catch (error) {
                throw new Error(`Query "${node.name}" is invalid. ${getErrorMessage(error)}`);
            }
        }

        const leftQuery = await this.buildQueryFromAst(node.left);
        const rightQuery = await this.buildQueryFromAst(node.right);

        return Operator[node.operator](leftQuery, rightQuery);
    }

    private render(): void {
        const fragment = document.createDocumentFragment();

        if (this.graphs.length === 0) {
            const empty = document.createElement("div");
            empty.className = "multi__empty";
            empty.textContent = "No graphs added yet.";
            fragment.appendChild(empty);
            this.tableRoot.replaceChildren(fragment);
            return;
        }

        fragment.appendChild(this.createHeaderRow());

        for (const graph of this.graphs) {
            fragment.appendChild(this.createGraphRow(graph));
        }

        this.tableRoot.replaceChildren(fragment);
    }

    private createHeaderRow(): HTMLDivElement {
        const row = document.createElement("div");
        row.className = "multi__header";

        const name = document.createElement("div");
        name.className = "multi__cell multi__cell--name";
        name.textContent = "Name";

        const actions = document.createElement("div");
        actions.className = "multi__cell multi__cell--actions";
        actions.textContent = "Actions";

        row.append(name, actions);
        return row;
    }

    private createGraphRow(graph: MultiGraph): HTMLDivElement {
        const row = document.createElement("div");
        row.className = "multi__row";

        const nameCell = document.createElement("div");
        nameCell.className = "multi__cell multi__cell--name";

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "multi__name-input";
        nameInput.value = graph.name;
        nameInput.addEventListener("change", () => {
            try {
                const newName = this.validateGraphName(nameInput.value, graph.id);
                graph.name = newName;
                this.onRename(graph, newName);
            } catch (error) {
                console.error(error);
                showToast(`Error: ${getErrorMessage(error)}`, "error");
            }

            nameInput.value = graph.name;
            nameInput.blur();
        });

        nameCell.appendChild(nameInput);

        const actionsCell = document.createElement("div");
        actionsCell.className = "multi__cell multi__cell--actions";

        const inspectButton = this.createButton("Inspect", "multi__button multi__button--secondary", () => {
            this.onInspect(graph.source);
        });

        const deleteButton = this.createButton("Delete", "multi__button multi__button--danger", () => {
            this.onDelete(graph);
        });

        actionsCell.append(inspectButton, deleteButton);
        row.append(nameCell, actionsCell);

        return row;
    }

    private createButton(
        label: string,
        className: string,
        onClick: () => void,
    ): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }
}
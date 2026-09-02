import Node, { QueryNode } from "@/graph/Node";
import Edge, { QueryEdge } from "@/graph/Edge";
import { ModeType } from "@/ui/controls/Tabbar";
import GraphDB from "@/db/db";
import { graphQuery } from "@/db/queryFunctions";
import { QueryValidationError } from "@/db/queryErrors";

export default abstract class Graph {
    abstract readonly mode: ModeType;
    readonly db: GraphDB | null;

    protected nodes: Node[] = [];
    protected edges: Edge[] = [];

    protected nodeCount = 0;
    protected edgeCount = 0;

    constructor(db: GraphDB | null) {
        this.db = db;
    }

    addNode(position: { x: number, y: number }, type?: string) {
        const node = type === "query"
            ? new QueryNode(`node-${Date.now()}`, `node${this.nodeCount++}`, position)
            : new Node(`node-${Date.now()}`, `node${this.nodeCount++}`, position);
        this.nodes.push(node);
        console.debug(`Node added: ${node.id}. Total nodes: ${this.nodes.length}`);
        return node;
    }

    addEdge(from: Node, to: Node, type?: string): Edge {
        const edge = type === "query"
            ? new QueryEdge(`edge-${Date.now()}`, `edge${this.edgeCount++}`, from, to)
            : new Edge(`edge-${Date.now()}`, `edge${this.edgeCount++}`, from, to);
        this.edges.push(edge);
        console.debug(`Edge added: ${edge.id} from ${edge.from.id} to ${edge.to.id}. Total edges: ${this.edges.length}`);
        return edge;
    }

    removeNode(node: Node) {
        this.nodes = this.nodes.filter(n => n !== node);
        console.debug(`Node removed: ${node.id}. Total nodes: ${this.nodes.length}`);
    }

    removeEdge(edge: Edge) {
        this.edges = this.edges.filter(e => e !== edge);
        console.debug(`Edge removed: ${edge.id}. Total edges: ${this.edges.length}`);
    }

    renameNode(node: Node, newName: string) {
        node.name = newName;
        console.debug(`Node renamed: ${node.id} to ${newName}`);
    }

    renameEdge(edge: Edge, newName: string) {
        edge.name = newName;
        console.debug(`Edge renamed: ${edge.id} to ${newName}`);
    }

    getNodes(): readonly Node[] {
        return this.nodes;
    }

    getEdges(): readonly Edge[] {
        return this.edges;
    }

    serialize(): Record<string, unknown> {
        return {
            mode: this.mode,
            nodes: this.nodes.map(node => node.serialize()),
            edges: this.edges.map(edge => edge.serialize())
        };
    }

    static deserialize(data: { mode: ModeType, nodes: any[], edges: any[] }, db: GraphDB | null, requiredMode?: ModeType, force: boolean = false): Graph {
        if (requiredMode && data.mode !== requiredMode) {
            if (!(force && requiredMode === ModeType.Querying && data.mode === ModeType.Modelling)) {
                throw new Error(`Attempted to load ${data.mode} graph when expected ${requiredMode} graph.`);
            }   
        }
        const graph = Graph.getGraphObject(requiredMode || data.mode, db);
        graph.nodes = data.nodes.map(nodeData => {
            const node = nodeData.type === "query"
                    ? new QueryNode(nodeData.id, nodeData.name, { x: nodeData.x, y: nodeData.y })
                    : new Node(nodeData.id, nodeData.name, { x: nodeData.x, y: nodeData.y });
            node.selected = nodeData.selected ?? false;
            return node;
        });
        graph.edges = data.edges.map(edgeData => {
            const fromNode = graph.nodes.find(n => n.id === edgeData.from);
            const toNode = graph.nodes.find(n => n.id === edgeData.to);
            if (fromNode && toNode) {
                const edge = edgeData.type === "query"
                        ? new QueryEdge(edgeData.id, edgeData.name, fromNode, toNode, edgeData.bidirectional)
                        : new Edge(edgeData.id, edgeData.name, fromNode, toNode, edgeData.bidirectional);
                edge.selected = edgeData.selected ?? false;
                return edge;
            }
            throw new Error(`Invalid edge data.`);
        });
        graph.nodeCount = graph.nodes.length;
        graph.edgeCount = graph.edges.length;
        console.debug(`Graph deserialized. Total nodes: ${graph.nodes.length}, Total edges: ${graph.edges.length}`);
        return graph;
    }

    static getGraphObject(mode: ModeType, db: GraphDB | null): Graph {
        switch (mode) {
            case ModeType.Modelling:
                return new ModelGraph(db);
            case ModeType.Querying:
                return new QueryGraph(db);
            default:
                throw new Error(`Unknown graph mode: ${mode}`);
        }
    }
}

export class ModelGraph extends Graph {
    readonly mode: ModeType = ModeType.Modelling;

    async updateDatabase() {
        if (!this.db) return;
        const nodesData = this.getNodes().map(node => ({
            id: node.id,
            name: node.name
        }));
        const edgesData = this.getEdges().map(edge => ({
            from: edge.from.id,
            name: edge.name,
            to: edge.to.id,
            id: edge.id
        }));
        await this.db.syncGraph(nodesData, edgesData);
    }

    addNode(position: { x: number, y: number }, type?: string) {
        const node = super.addNode(position, type);
        if (!this.db) return node;
        this.db.addNode(node.id, node.name);
        return node;
    }

    removeNode(node: Node) {
        super.removeNode(node);
        if (!this.db) return;
        this.db.removeNode(node.id);
    }

    renameNode(node: Node, newName: string) {
        super.renameNode(node, newName);
        if (!this.db) return;
        this.db.renameNode(node.id, newName);
    }

    addEdge(from: Node, to: Node, type?: string): Edge {
        const edge = super.addEdge(from, to, type);
        if (!this.db) return edge;
        this.db.addEdge(edge.id, from.id, edge.name, to.id);
        return edge;
    }

    removeEdge(edge: Edge) {
        super.removeEdge(edge);
        if (!this.db) return;
        this.db.removeEdge(edge.id);
    }

    renameEdge(edge: Edge, newName: string) {
        super.renameEdge(edge, newName);
        if (!this.db) return;
        this.db.renameEdge(edge.id, newName);
    }
}

export class QueryGraph extends Graph {
    readonly mode: ModeType = ModeType.Querying;
    protected override nodes: QueryNode[] = [];
    protected override edges: QueryEdge[] = [];

    async query() {
        await this.validateQuery();
        const edges = this.getEdges().map(edge => {
            return [edge.from.getName(), edge.getName(), edge.to.getName(), edge.bidirectional] as [string, string, string, boolean];
        });
        const vars = this.getSelected();
        return await graphQuery({ edges, vars });
    }

    getSelected(): string[] {
        return [...this.getNodes(), ...this.getEdges()].filter(v => v.selected).map(v => v.getName()).sort();
    }

    private async validateQuery() {
        if (!this.db) return;
        const constNodes = new Set(this.getNodes().filter(node => !(node instanceof QueryNode)).map(node => node.getName()));
        const missingNodes = []
        for (const name of constNodes) {
            if (!await this.db.hasNode(name)) {
                missingNodes.push(name);
            }
        }

        if (missingNodes.length > 0) {
            throw new QueryValidationError("Query validation failed. Some constants do not exist in the model.", missingNodes, []);
        }
    }
}
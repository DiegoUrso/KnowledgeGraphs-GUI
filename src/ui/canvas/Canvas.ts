import Konva from "konva";
import Graph, { ModelGraph, QueryGraph } from "@/graph/Graph";
import ContextMenu from "@/ui/canvas/ContextMenu";
import { Tool } from "@/ui/controls/Toolbar";
import NodeElement, { QueryNodeElement } from "@/ui/canvas/NodeElement";
import EdgeElement, { QueryEdgeElement } from "@/ui/canvas/EdgeElement";
import EventManager from "@/ui/canvas/EventManager";
import { QueryNode } from "@/graph/Node";
import { QueryEdge } from "@/graph/Edge";

export default abstract class Canvas<G extends Graph, N extends NodeElement, E extends EdgeElement> {
    readonly stage: Konva.Stage;
    
    protected readonly layer: Konva.Layer;
    protected readonly eventManager: EventManager;

    onChange: (isSaved: boolean) => void;

    protected graph: G;
    protected nodes: N[] = [];
    protected edges: E[] = [];
    protected edgesMap: Map<string, E[]> = new Map();

    hasPendingChanges: boolean = false;
    
    abstract createNodeElement(node: any): N;
    abstract createEdgeElement(edge: any): E;

    constructor(
        container: string,
        graph: G,
        onChange: (isSaved: boolean) => void
    ) {
        this.stage = new Konva.Stage({
            container,
            width: window.innerWidth,
            height: window.innerHeight,
            background: "white",
            draggable: true,
        });
        this.graph = graph;
        this.layer = new Konva.Layer();
        this.stage.add(this.layer);

        new ContextMenu(this);
        this.eventManager = new EventManager(this, this.layer);
        this.layer.draw();
        this.onChange = onChange;

        window.addEventListener("resize", () => {
            this.stage.width(window.innerWidth);
            this.stage.height(window.innerHeight);
        });
    }

    addNode(pos: Konva.Vector2d, newNode?: N) {
        const node = newNode || (this.eventManager.getCurrentTool() === Tool.InsertQueryNode
            ? new QueryNodeElement(this.graph.addNode(pos, "query"))
            : this.createNodeElement(this.graph.addNode(pos))
        ) as N;
        this.eventManager.nodeEvents(node);
        this.layer.add(node);
        this.nodes.push(node);
        if (!newNode) {
            node.editLabel(this.onChange);
        }
        this.onChange(false);
    }

    removeNode(node: N) {
        const edgesToRemove = this.edges.filter(edge => edge.sourceNode === node.node || edge.targetNode === node.node);
        edgesToRemove.forEach(edge => this.removeEdge(edge));
        this.graph.removeNode(node.node);
        node.destroy();
        this.nodes = this.nodes.filter(n => n !== node);
        this.onChange(false);
    }

    addEdge(from: N, to: N, newEdge?: E) {
        const edge = newEdge || (this.eventManager.getCurrentTool() === Tool.InsertQueryEdge
            ? new QueryEdgeElement(this.graph.addEdge(from.node, to.node, "query"))
            : this.createEdgeElement(this.graph.addEdge(from.node, to.node))
        ) as E;
        this.eventManager.edgeEvents(edge);
        this.layer.add(edge);
        this.edges.push(edge);
        const nodes = [edge.sourceNode.id, edge.targetNode.id].sort() as [string, string];
        const nodesId = nodes.join("|");
        if (!this.edgesMap.has(nodesId)) {
            this.edgesMap.set(nodesId, []);
        }
        this.edgesMap.get(nodesId)!.push(edge);
        if (!newEdge) {
            this.setOffsets(nodesId);
            edge.editLabel(this.onChange);
        }
        this.onChange(false);
    }

    removeEdge(edge: E) {
        this.graph.removeEdge(edge.edge);
        edge.destroy();
        this.edges = this.edges.filter(e => e !== edge);
        const nodes = [edge.sourceNode.id, edge.targetNode.id].sort() as [string, string];
        const nodesId = nodes.join("|");
        const edgesForNodes = this.edgesMap.get(nodesId);
        if (edgesForNodes) {
            this.edgesMap.set(nodesId, edgesForNodes.filter(e => e !== edge));
            if (this.edgesMap.get(nodesId)!.length === 0) {
                this.edgesMap.delete(nodesId);
            } else {
                this.setOffsets(nodesId);
            }
        }
        this.onChange(false);
    }

    addBidirectionalEdge(edge: E) {
        edge.addBidirectionalEdge();
    }

    removeBidirectionalEdge(edge: E) {
        edge.removeBidirectionalEdge();
    }

    setTool(tool: Tool) {
        this.stage.draggable(tool === Tool.Select);
        this.eventManager.setTool(tool);
    }

    getNodes(): readonly NodeElement[] {
        return this.nodes;
    }

    getEdges(): readonly EdgeElement[] {
        return this.edges;
    }

    getEdgesMap(): Map<string, EdgeElement[]> {
        return new Map(this.edgesMap);
    }

    freeze() {
        this.eventManager.freeze();
        this.stage.container().style.cursor = "wait";
    }

    unfreeze() {
        this.eventManager.unfreeze();
        this.eventManager.updateCursor();
    }

    hideCanvas() {
        this.stage.hide();
    }

    showCanvas() {
        this.stage.show();
    }

    getGraph(): G {
        return this.graph;
    }

    setGraph(graph: G) {
        this.graph = graph;
        this.redraw();
    }

    redraw() {
        const nodes = this.graph.getNodes()
        const edges = this.graph.getEdges();
        this.clearCanvas();
        nodes.forEach(node => {
            const nodeElement =  node instanceof QueryNode ? new QueryNodeElement(node) : this.createNodeElement(node);
            this.addNode({ x: node.x, y: node.y }, nodeElement as N);
            nodeElement.setLabelText(node.name);
            if (node.selected) nodeElement.toggleSelected();
        });
        edges.forEach(edge => {
            const sourceNodeElement = this.nodes.find(n => n.node === edge.from);
            const targetNodeElement = this.nodes.find(n => n.node === edge.to);
            if (sourceNodeElement && targetNodeElement) {
                const edgeElement = edge instanceof QueryEdge ? new QueryEdgeElement(edge) : this.createEdgeElement(edge);
                this.addEdge(sourceNodeElement, targetNodeElement, edgeElement as E);
                edgeElement.setLabelText(edge.name);
                if (edge.selected) edgeElement.toggleSelected();
                if (edge.bidirectional) edgeElement.addBidirectionalEdge();
            } else {
                console.warn(`Edge ${edge.id} could not be created because one of its nodes is missing.`);
            }
        });
        this.edgesMap.forEach((_, nodesId) => {
            this.setOffsets(nodesId);
        });
        this.layer.draw();
    }

    clearCanvas() {
        this.nodes.forEach(node => node.destroy());
        this.edges.forEach(edge => edge.destroy());
        this.nodes = [];
        this.edges = [];
        this.edgesMap.clear();
        this.onChange(true);
    }

    protected setOffsets(nodesId: string) {
        const edges = this.edgesMap.get(nodesId);
        if (!edges || edges.length < 1) return;
        const step = 40; 
        let maxOffset = edges.length % 2 === 0 ? (edges.length / 2)*step : ((edges.length - 1) / 2)*step;
        if (edges.length === 2) maxOffset = step / 2; // Cosmetic adjustment for two edges
        for (let i = 0; i < edges.length; i++) {
            let offset = maxOffset - step * i;
            const nodeId = [edges[i].sourceNode.id, edges[i].targetNode.id].join("|") ;
            if (nodesId === nodeId) {
                offset = -offset;
            }
            edges[i].updateOffset(offset);
            console.debug(`\tEdge ${edges[i].id()} offset set to ${offset}`);
        }
    }
}

export class ModelCanvas extends Canvas<ModelGraph, NodeElement, EdgeElement> {
    createNodeElement(node: any): NodeElement {
        return new NodeElement(node);
    }

    createEdgeElement(edge: any): EdgeElement {
        return new EdgeElement(edge);
    }

    addBidirectionalEdge(edge: EdgeElement) {
        super.addBidirectionalEdge(edge);
    }

    removeBidirectionalEdge(edge: EdgeElement) {
        super.removeBidirectionalEdge(edge);
    }
    
    async setGraph(graph: ModelGraph) {
        await graph.updateDatabase();
        super.setGraph(graph);
    }

    setSelected(selectedIds: Set<string>, color?: string) {
        this.nodes.forEach(node => {
            if (selectedIds.has(node.node.id) && !node.selected) {
                node.toggleSelected(color);
            } else if (!selectedIds.has(node.node.id) && node.selected) {
                node.toggleSelected(color);
            }
        });
        this.edges.forEach(edge => {
            if (selectedIds.has(edge.edge.id) && !edge.selected) {
                edge.toggleSelected(color);
            } else if (!selectedIds.has(edge.edge.id) && edge.selected) {
                edge.toggleSelected(color);
            }
        });
    }

    clearSelected() {
        this.nodes.forEach(node => {
            if (node.selected) {
                node.toggleSelected();
            }
        });
        this.edges.forEach(edge => {
            if (edge.selected) {
                edge.toggleSelected();
            }
        });
    }
}

export class QueryCanvas extends Canvas<QueryGraph, NodeElement, EdgeElement> {
    createNodeElement(node: any): NodeElement {
        return new NodeElement(node);
    }

    createEdgeElement(edge: any): EdgeElement {
        return new EdgeElement(edge);
    }
}
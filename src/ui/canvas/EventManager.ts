import Konva from "konva";
import type Canvas from "@/ui/canvas/Canvas";
import { Tool } from "@/ui/controls/Toolbar";
import NodeElement from "@/ui/canvas/NodeElement";
import type EdgeElement from "@/ui/canvas/EdgeElement";
import type Graph from "@/graph/Graph";

export default class EventManager {
    private readonly canvas: Canvas<Graph, NodeElement, EdgeElement>;
    private readonly layer: Konva.Layer;

    private startingNode: NodeElement | null = null;
    private tempLine: Konva.Line | null = null;
    
    private currentTool: Tool = Tool.Select;

    private frozen = false;

    constructor(canvas: Canvas<Graph, NodeElement, EdgeElement>, layer: Konva.Layer) {
        this.canvas = canvas;
        this.layer = layer;
        this.changeCursor("grab");

        this.zoomEvent();
        this.dragEvent();
        this.edgePreviewEvent();

        canvas.stage.on('click', (e) => {
            if (this.startingNode !== null) {
                this.cancelEdgeCreation();
            }
            if (!this.isLeftClick(e)) return;
            const nodeTools: Tool[] = [Tool.InsertNode, Tool.InsertQueryNode];
            if (nodeTools.includes(this.currentTool)) {
                const pos = this.layer.getRelativePointerPosition() as Konva.Vector2d;
                canvas.addNode(pos);
            }
        });
    }

    // ----------------------------
    // General management
    // ----------------------------

    freeze() {
        this.frozen = true;
    }

    unfreeze() {
        this.frozen = false;
    }

    setTool(tool: Tool) {
        this.currentTool = tool;
        this.updateCursor();
        this.cancelEdgeCreation();
    }

    getCurrentTool(): Tool {
        return this.currentTool;
    }

    changeCursor(cursor: string) {
        if (this.frozen) return;
        this.canvas.stage.container().style.cursor = cursor;
    }

    updateCursor() {
        switch (this.currentTool) {
            case Tool.Select:
                this.changeCursor("grab");
                break;
            case Tool.InsertNode:
            case Tool.InsertQueryNode:
                this.changeCursor("crosshair");
                break;
            default:
                this.changeCursor("default");
        }
    }

    // ----------------------------
    // Element events
    // ----------------------------

    nodeEvents(node: NodeElement) {
        node.on("click", (e) => {
            if (!this.isLeftClick(e)) return;
            const edgeTools: Tool[] = [Tool.InsertEdge, Tool.InsertQueryEdge];
            if (edgeTools.includes(this.currentTool)) {
                e.cancelBubble = true; // Prevent the stage click event
                if (this.startingNode === null) {
                    this.startingNode = node;
                } else {
                    if (this.startingNode === node) {
                        return;
                    }
                    this.canvas.addEdge(this.startingNode, node);
                    this.cancelEdgeCreation();
                }
            }
        });

        node.on("mouseenter", () => {
            switch (this.currentTool) {
                case Tool.Select:
                    this.changeCursor("default");
                    break;
                case Tool.InsertEdge:
                case Tool.InsertQueryEdge:
                    this.changeCursor("crosshair");
                    break;
            }
        });
        node.on("mouseleave", () => this.updateCursor());

        node.label.on("textChange", () => {
            this.canvas.getGraph().renameNode(node.node, node.getLabelText());
        });
    }

    edgeEvents(edge: EdgeElement) {
        edge.on("mouseenter", () => {
            if (this.currentTool === Tool.Select) {
                this.changeCursor("default");
            }
        });
        edge.on("mouseleave", () => this.updateCursor());
        edge.label.on("textChange", () => {
            this.canvas.getGraph().renameEdge(edge.edge, edge.getLabelText());
        });
    }

    // ----------------------------
    // Stage events
    // ----------------------------

    private zoomEvent() {
        const scaleBy = 1.04;
        this.canvas.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = this.canvas.stage.scaleX();
            const pointer = this.canvas.stage.getPointerPosition() as Konva.Vector2d;
            const mousePointTo = {
                x: (pointer.x - this.canvas.stage.x()) / oldScale,
                y: (pointer.y - this.canvas.stage.y()) / oldScale,
            };
            let direction = e.evt.deltaY > 0 ? -1 : 1;
            if (e.evt.ctrlKey) { direction = -direction; }
            let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            newScale = Math.max(0.2, Math.min(5, newScale));
            this.canvas.stage.scale({ x: newScale, y: newScale });
            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            this.canvas.stage.position(newPos);
        });
    }

    private dragEvent() {
        this.canvas.stage.on("dragstart", (e) => {
            if (e.target === this.canvas.stage && this.currentTool === Tool.Select) {
                this.changeCursor("grabbing");
            }
        });
        this.canvas.stage.on("dragend", (e) => {
            if (e.target === this.canvas.stage && this.currentTool === Tool.Select) {
                this.changeCursor("grab");
            }
        });
        this.canvas.stage.on("dragmove", (e) => {
            if (e.target instanceof NodeElement) {
                const node = e.target;
                node.node.x = node.x();
                node.node.y = node.y();
                this.canvas.getEdges()
                    .filter(edge => edge.sourceNode === node.node || edge.targetNode === node.node)
                    .forEach(edge => edge.updatePosition());
            }
        });
    }

    private edgePreviewEvent() {
        this.canvas.stage.on("mousemove", () => {
            if (this.startingNode === null) return;
            const pos = this.layer.getRelativePointerPosition() as Konva.Vector2d;
            if (!this.tempLine) {
                this.tempLine = new Konva.Line({
                    points: [this.startingNode.x(), this.startingNode.y(), pos.x, pos.y],
                    stroke: "gray",
                    strokeWidth: 2,
                    dash: [4, 4],
                });
                this.layer.add(this.tempLine);
            } else {
                const x1 = this.startingNode.x();
                const y1 = this.startingNode.y();

                const x2 = pos.x;
                const y2 = pos.y;

                const dx = x2 - x1;
                const dy = y2 - y1;

                const length = Math.hypot(dx, dy);

                const cursorGap = 8;

                const endX = length > cursorGap
                    ? x2 - (dx / length) * cursorGap
                    : x2;

                const endY = length > cursorGap
                    ? y2 - (dy / length) * cursorGap
                    : y2;

                this.tempLine.points([x1, y1, endX, endY]);
            }
        });
    }

    private cancelEdgeCreation() {
        this.startingNode = null;
        if (this.tempLine) {
            this.tempLine.destroy();
            this.tempLine = null;
        }
    }

    // ----------------------------
    // Utility methods
    // ----------------------------

    private isLeftClick(e: Konva.KonvaEventObject<MouseEvent>): boolean {
        return e.evt.button === 0;
    }
    
    /* private isRightClick(e: Konva.KonvaEventObject<MouseEvent>): boolean {
        return e.evt.button === 2;
    } */
}
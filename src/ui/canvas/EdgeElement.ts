import Konva from "konva";
import Edge from "@/graph/Edge";
import { Context } from "@/ui/canvas/ContextMenu";
import GraphElement from "@/ui/canvas/GraphElement";
import Node from "@/graph/Node";
import warningIcon from "@/assets/warning.svg";

export default class EdgeElement extends GraphElement {
    readonly edge: Edge;
    readonly line: Konva.Line;
    readonly label: Konva.Text;
    readonly background: Konva.Rect;
    readonly arrow: Konva.Shape;
    readonly oppositeArrow: Konva.Shape;
    readonly warning: Konva.Image;
    readonly sourceNode: Node;
    readonly targetNode: Node;
    curveOffset: number = 0;
    context: Context[] = [Context.ToggleBidirectional, Context.EditLabel, Context.Delete];
    selected: boolean = false;
    bidirectional: boolean = false;

    constructor(edge: Edge) {
        super({
            id: edge.id,
            name: "edge",
            draggable: false
        });
        this.edge = edge;

        this.sourceNode = edge.from;
        this.targetNode = edge.to;
        this.bidirectional = edge.bidirectional;

        this.line = new Konva.Line({
            name: "edge-line",
            stroke: "black",
            strokeWidth: 2
        });

        this.arrow = new Konva.Shape({
            name: "edge-arrow",
            sceneFunc: (context, shape) => {
                const points = this.line.points();
                const x1 = points[2];
                const y1 = points[3];
                const x2 = points[4];
                const y2 = points[5];

                const angle = Math.atan2(y2 - y1, x2 - x1);
                const arrowLength = 5;

                context.beginPath();
                context.moveTo(x2, y2);
                context.lineTo(x2 - arrowLength * Math.cos(angle - Math.PI / 6), y2 - arrowLength * Math.sin(angle - Math.PI / 6));
                context.lineTo(x2 - arrowLength * Math.cos(angle + Math.PI / 6), y2 - arrowLength * Math.sin(angle + Math.PI / 6));
                context.closePath();
                context.fillStrokeShape(shape);
            },
            fill: "black",
            stroke: "black",
            strokeWidth: 2
        }); 

        this.oppositeArrow = new Konva.Shape({
            name: "edge-opposite-arrow",
            sceneFunc: (context, shape) => {
                const points = this.line.points();
                const x1 = points[0];
                const y1 = points[1];
                const x2 = points[2];
                const y2 = points[3];

                const angle = Math.atan2(y2 - y1, x2 - x1);
                const arrowLength = 5;

                context.beginPath();
                context.moveTo(x1, y1);
                context.lineTo(x1 + arrowLength * Math.cos(angle - Math.PI / 6), y1 + arrowLength * Math.sin(angle - Math.PI / 6));
                context.lineTo(x1 + arrowLength * Math.cos(angle + Math.PI / 6), y1 + arrowLength * Math.sin(angle + Math.PI / 6));
                context.closePath();
                context.fillStrokeShape(shape);
            },
            fill: "black",
            stroke: "black",
            strokeWidth: 2,
            visible: this.bidirectional
        });

        this.background = new Konva.Rect({
            name: "edge-label-background",
            fill: "white"
        });

        this.label = new Konva.Text({
            name: "edge-label",
            text: edge.name,
            fontSize: 15,
            fill: "black"
        });

        const icon = document.createElement("img");
        icon.src = warningIcon;
        icon.alt = "Warning";
        this.warning = new Konva.Image({
            name: "node-warning",
            image: icon,
            width: 20,
            height: 20,
            visible: false
        });

        this.add(this.line);
        this.add(this.arrow);
        this.add(this.background);
        this.add(this.label);
        this.add(this.oppositeArrow);
        this.add(this.warning);
        this.updatePosition();
    }

    addBidirectionalEdge() {
        this.bidirectional = true;
        this.edge.bidirectional = true;
        this.oppositeArrow.visible(true);
    }

    removeBidirectionalEdge() {
        this.bidirectional = false;
        this.edge.bidirectional = false;
        this.oppositeArrow.visible(false);
    }

    toggleSelected(color: string = "green") {
        this.selected = !this.selected;
        const set_color = this.selected ? color : "black";
        this.line.stroke(set_color);
        this.arrow.stroke(set_color);
        this.arrow.fill(set_color);
        this.oppositeArrow.stroke(set_color);
        this.oppositeArrow.fill(set_color);
    }

    showWarning() {
        this.warning.visible(true);
    }

    clearWarning() {
        this.warning.visible(false);
    }

    updateOffset(offset: number) {
        this.curveOffset = offset;
        this.updatePosition();
    }

    updatePosition() {
        const x1 = this.sourceNode.x;
        const y1 = this.sourceNode.y;

        const x2 = this.targetNode.x;
        const y2 = this.targetNode.y;

        const dx = x2 - x1;
        const dy = y2 - y1;

        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return;

        const r1 = this.sourceNode.radius;
        const r2 = this.targetNode.radius;

        // Unit direction vector
        const ux = dx / length;
        const uy = dy / length;

        // Unit perpendicular vector
        const nx = -uy;
        const ny = ux;

        const edgeOffset = this.curveOffset /4;

        const startX = x1 + ux * r1 + nx * edgeOffset;
        const startY = y1 + uy * r1 + ny * edgeOffset;

        const endX = x2 - ux * r2 + nx * edgeOffset;
        const endY = y2 - uy * r2 + ny * edgeOffset;

        // Midpoint
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        // Control point
        const controlX = midX + nx * this.curveOffset;
        const controlY = midY + ny * this.curveOffset;

        this.line.points([
            startX,
            startY,
            controlX,
            controlY,
            endX,
            endY
        ]);

        this.centerLabel();
    }

    protected centerLabel() {
        const width = this.line.points()[2];
        const height = this.line.points()[3];

        this.label.offsetX(-width + this.label.width() / 2);
        this.label.offsetY(-height + this.label.height() / 2);
        this.background.width(this.label.width() + 10);
        this.background.height(this.label.height() + 4);
        this.background.offsetX(-width + this.background.width() / 2 );
        this.background.offsetY(-height + this.background.height() / 2 );
        this.warning.offsetX(-width - this.background.width() / 2 + 5);
        this.warning.offsetY(-height + this.warning.height());
    }

}

export class QueryEdgeElement extends EdgeElement {
    constructor(edge: Edge) {
        super(edge);
        this.label.text('?'+this.getLabelText());
        this.line.dash([10, 5]);

        this.context.push(Context.ToggleSelected);
    }

    setLabelText(text: string) {
        const newText = text.replaceAll("?", "");
        this.label.text('?'+newText);
        this.centerLabel();
    }
}
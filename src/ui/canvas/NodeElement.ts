import Konva from "konva";
import Node from "@/graph/Node";
import { Context } from "@/ui/canvas/ContextMenu";
import GraphElement from "@/ui/canvas/GraphElement";
import warningIcon from "@/assets/warning.svg";

export default class NodeElement extends GraphElement {
    readonly node: Node;
    readonly circle: Konva.Circle;
    readonly label: Konva.Text;
    readonly warning: Konva.Image;
    context: Context[] = [Context.EditLabel, Context.Delete];
    selected: boolean = false;

    constructor(node: Node) {
        super({
            id: node.id,
            x: node.x,
            y: node.y,
            draggable: true
        });

        this.node = node;

        this.circle = new Konva.Circle({
            name: "node-circle",
            radius: node.radius,
            fill: "yellow",
            stroke: "black",
            strokeWidth: 2
        });
        this.label = new Konva.Text({
            name: "node-label",
            text: node.name,
            fontSize: 16,
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
            offsetX: -(node.radius * 0.7),
            offsetY: node.radius * 0.7,
            visible: false
        });

        this.add(this.circle);
        this.add(this.label);
        this.add(this.warning);
        this.centerLabel();
    }

    toggleSelected(color: string = "green") {
        this.selected = !this.selected;
        this.circle.fill(this.selected ? color : "yellow");
    }

    showWarning() {
        this.warning.visible(true);
    }

    clearWarning() {
        this.warning.visible(false);
    }

    protected centerLabel() {
        this.label.offsetX(this.label.width() / 2);
        this.label.offsetY(this.label.height() / 2);
    }
}

export class QueryNodeElement extends NodeElement {
    constructor(node: Node) {
        super(node);
        this.label.text('?'+this.getLabelText());
        this.circle.fill("#FFF7A8");
        this.circle.dash([10, 5]);

        this.context.push(Context.ToggleSelected);
    }

    setLabelText(text: string) {
        const newText = text.replaceAll("?", "");
        this.label.text('?'+newText);
        this.centerLabel();
    }

    toggleSelected() {
        this.selected = !this.selected;
        this.node.selected = this.selected;
        this.circle.fill(this.selected ? "#B8D8A8" : "#FFF7A8");
    }
}
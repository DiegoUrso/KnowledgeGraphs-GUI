import Konva from "konva";
import GraphElement from "@/ui/canvas/GraphElement";
import NodeElement from "@/ui/canvas/NodeElement";
import EdgeElement from "@/ui/canvas/EdgeElement";
import type Canvas from "@/ui/canvas/Canvas";
import type Graph from "@/graph/Graph";
import { ModelCanvas } from "@/ui/canvas/Canvas";

export const Context = {
    EditLabel: "Edit Label",
    Delete: "Delete",
    ToggleBidirectional: "Toggle Bidirectional",
    ToggleSelected: "Toggle Selected",
}
export type Context = typeof Context[keyof typeof Context];

export default class ContextMenu {
    private readonly menu: HTMLDivElement;
    private readonly buttons: HTMLButtonElement[];

    private readonly stage: Konva.Stage;
    private readonly canvas: Canvas<Graph, NodeElement, EdgeElement>;

    private currentObj: GraphElement = undefined as any;

    constructor(canvas: Canvas<Graph, NodeElement, EdgeElement>) {
        this.canvas = canvas;
        this.stage = canvas.stage;

        this.menu = document.createElement('div');
        this.menu.id = 'menu';
        this.menu.style.display = 'none';
        this.menu.style.position = 'fixed';
        this.menu.style.width = '120px';
        this.menu.style.backgroundColor = 'white';
        this.menu.style.boxShadow = '0 0 5px grey';
        this.menu.style.borderRadius = '3px';

        window.addEventListener('click', () => {
            this.menu.style.display = 'none';
        });

        this.buttons = this.createButtons();
        this.menu.append(...this.buttons);

        this.stage.on('contextmenu', (e) => {
            e.evt.preventDefault();
            if (e.target === this.stage) {
                return;
            }
            this.currentObj = e.target.getParent() as GraphElement;
            this.manageButtonStates(this.currentObj);
            const pos = this.stage.getPointerPosition() as Konva.Vector2d;
            this.menu.style.display = 'initial';
            const containerRect = this.stage.container().getBoundingClientRect();
            this.menu.style.top = containerRect.top + pos.y + 4 + 'px';
            this.menu.style.left = containerRect.left + pos.x + 4 + 'px';
        });

        document.body.appendChild(this.menu);
    }

    private manageButtonStates(node: GraphElement) {
        this.buttons.forEach(button => {
            const isVisible = node.context.includes(button.textContent as Context);
            button.disabled = !isVisible;
            button.hidden = !isVisible;
        });
    }

    private createButton(name: Context, onClick?: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = name;
        button.style.width = '100%';
        button.style.backgroundColor = 'white';
        button.style.border = 'none';
        button.style.margin = '0';
        button.style.padding = '10px';

        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = 'lightgray';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = 'white';
        });

        if (onClick) {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    private createButtons() {
        const buttons: HTMLButtonElement[] = [];

        buttons.push(this.createButton(Context.ToggleSelected, () => {
            this.currentObj.toggleSelected();
            this.canvas.onChange(false);
        }));
        buttons.push(this.createButton(Context.ToggleBidirectional, () => {
            if (this.currentObj instanceof EdgeElement) {
                if (!this.currentObj.bidirectional) {
                    this.canvas.addBidirectionalEdge(this.currentObj);
                    console.log("Bidirectional edge added.");
                } else {
                    this.canvas.removeBidirectionalEdge(this.currentObj);
                    console.log("Bidirectional edge removed.");
                }
                this.canvas.onChange(false);
            }
        }));
        buttons.push(this.createButton(Context.EditLabel, () => {
            if (this.currentObj instanceof EdgeElement && this.canvas instanceof ModelCanvas) {
                this.currentObj.editLabel(this.canvas.onChange, true);
            } else {
                this.currentObj.editLabel(this.canvas.onChange);
            }
        }));
        buttons.push(this.createButton(Context.Delete, () => {
            if (this.currentObj instanceof NodeElement) {
                this.canvas.removeNode(this.currentObj);
            } else if (this.currentObj instanceof EdgeElement) {
                this.canvas.removeEdge(this.currentObj);
            }
        }));

        return buttons;
    }
}
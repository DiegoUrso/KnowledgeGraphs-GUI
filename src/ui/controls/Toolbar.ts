import { ModeType } from "@/ui/controls/Tabbar";
import cursorIcon from "@/assets/cursor.svg";
import nodeIcon from "@/assets/node.svg";
import queryNodeIcon from "@/assets/querynode.svg";
import edgeIcon from "@/assets/edge.svg";
import queryEdgeIcon from "@/assets/queryedge.svg";

export const Tool = {
    Select: "Select",
    InsertNode: "Insert Node",
    InsertEdge: "Insert Edge",

    InsertQueryNode: "Insert Query Node",
    InsertQueryEdge: "Insert Query Edge",
} as const;
export type Tool = typeof Tool[keyof typeof Tool];

const ButtonType = {
    ...Tool,
    AddGraph: "Add Graph",
    Query: "Query",
    Load: "Load",
    Save: "Save",
    Download: "Download",
    Reset: "Reset",
}
type ButtonType = typeof ButtonType[keyof typeof ButtonType];

export default class Toolbar {
    private currentMode: ModeType = undefined as any;
    private currentTool: Tool = Tool.Select;
    private onToolChanged: (tool: Tool) => void;
    private onQuery: () => void;
    private onLoad: () => void;
    private onSave: () => void;
    private onDownload: () => void;
    private onReset: () => void;
    private onAddGraph: () => void;

    private readonly buttons: HTMLButtonElement[] = [];

    constructor(
        onToolChanged: (tool: Tool) => void,
        onQuery: () => void,
        onLoad: () => void,
        onSave: () => void,
        onDownload: () => void,
        onReset: () => void,
        onAddGraph: () => void
    ) {
        this.onToolChanged = onToolChanged;
        this.onQuery = onQuery;
        this.onLoad = onLoad;
        this.onSave = onSave;
        this.onDownload = onDownload;
        this.onReset = onReset;
        this.onAddGraph = onAddGraph;
        this.createToolbar();
    }

    getCurrentTool(): Tool {
        return this.currentTool;
    }

    changeMode(mode: ModeType) : boolean {
        if (this.currentMode === mode) return false;
        this.currentMode = mode;
        this.updateToolbar();
        return true;
    }

    resetTool() {
        this.buttons[0].click();
    }

    freeze() {
        this.resetTool();
        this.buttons.forEach(button => {
            button.disabled = true;
        });
    }

    unfreeze() {
        this.buttons.forEach(button => {
            button.disabled = false;
        });
    }

    private createToolbar() {
        const toolbar = document.querySelector(".menu__toolbar") as HTMLDivElement;

        const nav = this.createToolButton(cursorIcon, Tool.Select);
        const node = this.createToolButton(nodeIcon, Tool.InsertNode);
        const query_node = this.createToolButton(queryNodeIcon, Tool.InsertQueryNode);
        const edge = this.createToolButton(edgeIcon, Tool.InsertEdge);
        const query_edge = this.createToolButton(queryEdgeIcon, Tool.InsertQueryEdge);

        this.buttons.push(nav, node, query_node, edge, query_edge);
        this.buttons.forEach(button => toolbar.appendChild(button));

        const spacer = document.createElement("div");
        spacer.className = "spacer";

        const addGraphButton = this.createButton(ButtonType.AddGraph, "＋", () => {
            this.onAddGraph();
        });
        const queryButton = this.createButton(ButtonType.Query, "🔍", () => {
            this.onQuery();
        });
        const loadButton = this.createButton(ButtonType.Load, "📂", () => {
            this.onLoad();
        });
        const downloadButton = this.createButton(ButtonType.Download, "⬇️", () => {
            this.onDownload();
        });
        const saveButton = this.createButton(ButtonType.Save, "💾", () => {
            this.onSave();
        });
        const resetButton = this.createButton(ButtonType.Reset, "↩️", () => {
            this.onReset();
        });

        toolbar.appendChild(addGraphButton);
        toolbar.appendChild(spacer);
        toolbar.appendChild(queryButton);
        toolbar.appendChild(saveButton);
        toolbar.appendChild(resetButton);
        toolbar.appendChild(loadButton);
        toolbar.appendChild(downloadButton);
    }

    private createToolButton(iconPath: string, tool: Tool): HTMLButtonElement {
        const button = document.createElement("button");
        button.classList.add("menu__tool");
        button.name = tool;
        button.innerHTML = `<img src="${iconPath}" alt="${tool}" />`;
        button.onclick = () => {
            this.currentTool = tool;
            this.onToolChanged(this.currentTool);
            this.buttons.forEach(b => b.classList.remove("selected"));
            button.classList.add("selected");
        };
        return button;
    }

    private createButton(name: ButtonType, text?: string, onclick?: () => void): HTMLButtonElement {
        const button = document.createElement("button");
        button.classList.add("menu__button");
        button.name = name;
        button.textContent = text ?? name;
        if (onclick) {
            button.onclick = onclick;
        }
        this.buttons.push(button);
        return button;
    }

    private updateToolbar() {
        const visible = VISIBLE_BUTTONS[this.currentMode];
        this.buttons.forEach(button => {
            const isVisible = visible.includes(button.name as ButtonType);
            button.disabled = !isVisible;
            button.hidden = !isVisible;
        });
    }
}

const VISIBLE_BUTTONS: Record<ModeType, readonly ButtonType[]> = {
    [ModeType.Modelling]: [
        ButtonType.Select,
        ButtonType.InsertNode,
        ButtonType.InsertEdge,
        ButtonType.Load,
        ButtonType.Save,
        ButtonType.Download,
        ButtonType.Reset,
    ],
    [ModeType.Querying]: [
        ButtonType.Select,
        ButtonType.InsertNode,
        ButtonType.InsertQueryNode,
        ButtonType.InsertEdge,
        ButtonType.InsertQueryEdge,
        ButtonType.Query,
        ButtonType.Load,
        ButtonType.Download,
        ButtonType.Reset,
    ],
    [ModeType.Multiquery]: [
        ButtonType.AddGraph,
        ButtonType.Query,
        ButtonType.Load,
        ButtonType.Download,
        ButtonType.Reset,
    ],
    [ModeType.Result]: [
        ButtonType.Download,
    ],
};
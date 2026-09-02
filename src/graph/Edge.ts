import Node from "@/graph/Node";

export default class Edge {
    readonly id: string;
    readonly from: Node;
    readonly to: Node;
    name: string;
    selected: boolean = false;
    bidirectional: boolean = false;

    constructor(id: string, name: string, from: Node, to: Node, bidirectional: boolean = false) {
        this.id = id;
        this.name = name.replaceAll("?", "");
        this.from = from;
        this.to = to;
        this.bidirectional = bidirectional;
    }

    getName(): string {
        return this.name;
    }

    serialize(): any {
        return {
            id: this.id,
            name: this.name,
            from: this.from.id,
            to: this.to.id,
            bidirectional: this.bidirectional
        };
    }
}

export class QueryEdge extends Edge {
    constructor(id: string, name: string, from: Node, to: Node, bidirectional: boolean = false) {
        super(id, name, from, to, bidirectional);
    }

    getName(): string {
        return '?' + this.name;
    }

    serialize(): any {
        const baseSerialization = super.serialize();
        return {
            ...baseSerialization,
            type: "query",
            selected: this.selected
        };
    }
}
export default class Node {
    readonly id: string;
    name: string;
    x: number;
    y: number;
    selected: boolean = false;

    readonly radius: number = 60;

    constructor( id: string, name: string, position: { x: number; y: number }) {
        this.id = id;
        this.name = name.replaceAll("?", "");
        this.x = position.x;
        this.y = position.y;
    }

    getName(): string {
        return this.name;
    }

    serialize(): any {
        return {
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y
        };
    }
}

export class QueryNode extends Node {
    constructor(id: string, name: string, position: { x: number; y: number }) {
        super(id, name, position);
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
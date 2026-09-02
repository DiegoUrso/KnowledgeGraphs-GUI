export class QueryValidationError extends Error {
    public readonly errorNodes: string[] | undefined;
    public readonly errorEdges: string[] | undefined;

    constructor(msg: string, errorNodes?: string[], errorEdges?: string[]) {
        super(msg);

        this.name = "QueryValidationError";
        this.errorNodes = errorNodes;
        this.errorEdges = errorEdges;

        Object.setPrototypeOf(this, QueryValidationError.prototype);
    }
}

export class QueryNavegationalError extends Error {
    public readonly errorEdge: string | undefined;

    constructor(msg: string, errorEdge?: string) {
        super(msg);

        this.name = "QueryNavegationalError";
        this.errorEdge = errorEdge;

        Object.setPrototypeOf(this, QueryNavegationalError.prototype);
    }
}

export class QueryTimeoutError extends Error {
    constructor(msg: string) {
        super(msg);

        this.name = "QueryTimeoutError";

        Object.setPrototypeOf(this, QueryTimeoutError.prototype);
    }
}
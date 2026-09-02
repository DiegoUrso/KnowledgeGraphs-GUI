import neo4j from "neo4j-driver";
import type { Driver, QueryResult } from "neo4j-driver";
import { QueryTimeoutError } from "@/db/queryErrors";

export default class GraphDB {
    private driver: Driver;

    private constructor(driver: Driver) {
        this.driver = driver;
    }

    static async create(
        uri = "bolt://localhost:7687", 
        user = "neo4j", 
        password = "password"
    ) {
        const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
        await driver.getServerInfo();
        const graph = new GraphDB(driver);
        await graph.reset();
        return graph;
    }

    private async initialize() {
        const session = this.driver.session();
        try {
            await session.run(`CREATE CONSTRAINT node_id IF NOT EXISTS FOR (n:Node) REQUIRE n.id IS UNIQUE`);
        } finally {
            await session.close();
        }
    }

    async close() {
        await this.driver.close();
    }

    async reset() {
        const session = this.driver.session();
        try {
            await session.run(`MATCH (n) DETACH DELETE n`);
        } finally {
            await session.close();
        }
        await this.initialize();
    }

    async syncGraph(nodes: any[], edges: any[]): Promise<void> {
        const session = this.driver.session();
        const tx = session.beginTransaction(); 
        try {
            await tx.run('MATCH (n) DETACH DELETE n');

            if (nodes.length > 0) {
                await tx.run(`
                    UNWIND $nodes AS n
                    CREATE (:Node {id: n.id, name: n.name})
                `, { nodes });
            }

            if (edges.length > 0) {
                await tx.run(`
                    UNWIND $edges AS e
                    MATCH (from:Node {id: e.from}), (to:Node {id: e.to})
                    CALL apoc.create.relationship(from, e.name, {id: e.id}, to) YIELD rel
                    RETURN count(*)
                `, { edges });
            }
            await tx.commit();
        } catch (error) {
            await tx.rollback();
            console.error("Error sincronizando el grafo, cambios revertidos:", error);
            throw error;
        } finally {
            await session.close();
        }
    }

    // ----------------------------
    // Nodes
    // ----------------------------

    async addNode(id: string, name: string) {
        const session = this.driver.session();
        try {
            await session.run(
                `CREATE (n:Node {id: $id, name: $name})`,
                { id, name }
            );
        } finally {
            await session.close();
        }
    }

    async removeNode(id: string) {
        const session = this.driver.session();
        try {
            await session.run(
                `MATCH (n:Node {id: $id}) DETACH DELETE n`,
                { id }
            );
        } finally {
            await session.close();
        }
    }

    async renameNode(id: string, newName: string) {
        const session = this.driver.session();
        try {
            await session.run(
                `MATCH (n:Node {id: $id}) SET n.name = $newName`,
                { id, newName }
            );
        } finally {
            await session.close();
        }
    }

    async hasNode(name: string) {
        const session = this.driver.session();
        try {
            const result = await session.run(
                `MATCH (n:Node {name: $name}) RETURN n`,
                { name }
            );
            console.log(`hasNode(${name}) result:`, result.records);
            return result.records.length > 0;
        } finally {
            await session.close();
        }
    }

    // ----------------------------
    // Edges
    // ----------------------------

    async addEdge(id: string, term1: string, label: string, term2: string) {
        const session = this.driver.session();
        try {
            await session.run(
                `
                MATCH (a:Node {id: $term1}), (b:Node {id: $term2})
                CALL apoc.create.relationship(a, $label, {id: $id}, b) YIELD rel
                RETURN rel
                `,
                { id, term1, label, term2 }
            );
        } finally {
            await session.close();
        }
    }

    async removeEdge(id: string) {
        const session = this.driver.session();
        try {
            await session.run(
                `
                MATCH ()-[r {id: $id}]->()
                DELETE r
                `,
                { id }
            );
        } finally {
            await session.close();
        }
    }

    async renameEdge(id: string, newLabel: string) {
        const session = this.driver.session();
        try {
            await session.run(
                `
                MATCH ()-[r {id: $id}]->()
                CALL apoc.refactor.setType(r, $newLabel) YIELD output
                RETURN output
                `,
                { id, newLabel }
            );
        } finally {
            await session.close();
        }
    }

    // ----------------------------
    // Queries
    // ----------------------------
    
    async query(cypher: string, params: Record<string, any> = {}, timeoutMs: number = 5000): Promise<any[]> {
        const session = this.driver.session();
        try {
            const result: QueryResult = await session.run(cypher, params, {
                timeout: timeoutMs
            });
            return result.records.map(record => record.toObject());
            
        } catch (error: any) {
            if (error.code === 'Neo.ClientError.Transaction.TransactionTimedOut' || 
                error.message.toLowerCase().includes('timeout')) {
                console.warn(`La consulta fue cancelada porque superó los ${timeoutMs}ms.`);
                throw new QueryTimeoutError(`La consulta fue cancelada porque superó los ${timeoutMs / 1000}s.`);
            }
            throw error;
        } finally {
            await session.close();
        }
    }

    // ----------------------------
    // Debugging
    // ----------------------------

    async getAllTables() {
        const nodes = await this.query(`MATCH (n:Node) RETURN n.id AS id, n.name AS name`);
        const edges = await this.query(`
            MATCH (a:Node)-[r]->(b:Node)
            RETURN a.id AS term1, type(r) AS label, r.id AS id, b.id AS term2
        `);

        return [nodes, edges];
    }
}
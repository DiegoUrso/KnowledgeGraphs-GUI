import Toolbar, { Tool } from "@/ui/controls/Toolbar";
import Tabbar, { ModeType } from "@/ui/controls/Tabbar";
import Canvas, { ModelCanvas, QueryCanvas } from "@/ui/canvas/Canvas";
import Graph, { ModelGraph, QueryGraph } from "@/graph/Graph";
import GraphDB from "@/db/db";
import { QueryTimeoutError, QueryValidationError } from "@/db/queryErrors";
import QueryViewer, { FloatingQueryViewer } from "@/ui/query/QueryViewer";
import downloadFile, { createZipFile } from "@/utils/download";
import getGraphData, { getMultipleGraphData } from "@/utils/filePicker";
import showToast from "@/utils/toast";
import toCsv from "@/utils/csv";
import type EdgeElement from "@/ui/canvas/EdgeElement";
import type NodeElement from "@/ui/canvas/NodeElement";
import Multiquery from "@/ui/query/Multiquery";
import Settings from "@/ui/controls/Settings";

type AppState = {
    mode: ModeType;
    currentCanvas: Canvas<Graph, NodeElement, EdgeElement> | null;
    lastQueryTable: Record<string, string>[];
    lastQuery: string | undefined;
    autoSaveTimer: number | undefined;
};

export default async function createApp() {
    const settings = new Settings(document.querySelector(".settings-modal")!);
    
    let graphDB: GraphDB | null = null;
    try {
        graphDB = await GraphDB.create(
            settings.config.dbUri,
            settings.config.dbUser,
            settings.config.dbPass
        );
    } catch (error: unknown) {
        console.error("Error creating GraphDB:", error);
        showToast("Failed to connect to the database.", "error");
    }
    
    const modelCanvas = new ModelCanvas("model", new ModelGraph(graphDB), onChange);
    const queryCanvas = new QueryCanvas("query", new QueryGraph(graphDB), onChange);
    const canvases = [modelCanvas, queryCanvas];

    const multi = new Multiquery(document.querySelector(".multi")!, onInspect);
    const queryViewer = new QueryViewer(document.querySelector(".query-viewer")!);
    const queryFloating = new FloatingQueryViewer(document.querySelector(".floating-container")!);

    const tabbar = new Tabbar(onModeChanged, onSettingsClicked);
    const toolbar = new Toolbar(onToolChanged, onQuery, onLoad, onSave, onDownload, onReset, onAddGraph);

    const state: AppState = {
        mode: ModeType.Modelling,
        currentCanvas: modelCanvas,
        lastQueryTable: [],
        lastQuery: undefined,
        autoSaveTimer: undefined
    };

    function syncModeUi() {
        modelCanvas.hideCanvas();
        queryCanvas.hideCanvas();
        queryViewer.hide();
        multi.hide();
        queryFloating.hide();
        settings.hide();

        switch (state.mode) {
            case ModeType.Modelling:
                state.currentCanvas = modelCanvas;
                modelCanvas.showCanvas();
                if (state.lastQuery) queryFloating.show();
                break;
            case ModeType.Querying:
                state.currentCanvas = queryCanvas;
                queryCanvas.showCanvas();
                break;
            case ModeType.Multiquery:
                state.currentCanvas = null;
                multi.show();
                break;
            case ModeType.Result:
                state.currentCanvas = null;
                queryViewer.show();
                break;
        }

        const changed = toolbar.changeMode(state.mode);
        if (changed) toolbar.resetTool();
    }

    function onModeChanged(mode: ModeType) {
        state.mode = mode;
        syncModeUi();
    }

    function onChange(isSaved: boolean) {
        if (!state.currentCanvas) return;
        state.currentCanvas.hasPendingChanges = !isSaved;
        tabbar.updateMode(isSaved);
        if (!isSaved) autoSave();
    }

    function autoSave() {
        if (state.mode === ModeType.Modelling && settings.config.autoSave) {
            clearTimeout(state.autoSaveTimer);
            state.autoSaveTimer = window.setTimeout(() => {
                onSave(true);
            }, 2000); 
        }
    }

    function onToolChanged(tool: Tool) {
        state.currentCanvas?.setTool(tool);
    }

    function onSettingsClicked() {
        settings.show();
    }

    function onRowClick(row: Record<string, string>) {
        const meta_cols = Object.keys(row).filter(key => key.startsWith("$"));
        const ids = new Set<string>();
        for (const col of meta_cols) {
            ids.add(row[col]);
        }
        modelCanvas.setSelected(ids, "cyan");
    }

    function loading(isLoading: boolean) {
        if (isLoading) {
            toolbar.freeze(); 
            tabbar.freeze();
            state.currentCanvas?.freeze();
            document.body.style.setProperty('cursor', 'wait', 'important');
        } else {
            toolbar.unfreeze(); 
            tabbar.unfreeze();
            state.currentCanvas?.unfreeze();
            document.body.style.removeProperty('cursor');
        }
    }

    function saveQueryState(table: Record<string, string>[], query: string) {
        state.lastQueryTable = table.map(row => 
            Object.fromEntries(
                Object.entries(row).filter(([key]) => !key.startsWith('$'))
            )
        );

        const regex = /(?:[^,]+?\s+AS\s+`\$[^`]+`\s*,\s*)|(?:,\s*[^,]+?\s+AS\s+`\$[^`]+`)|(?:[^,]+?\s+AS\s+`\$[^`]+`)/g;
        state.lastQuery = query.replace(regex, '').trim();
    }

    function render(table: Record<string, string>[], query?: string) {
        queryViewer.render(table, query, undefined, settings.config.resultLimit);
        queryFloating.render(table, undefined, onRowClick, settings.config.resultLimit);
        queryFloating.close();
    }

    function handleQueryError(error: unknown, canvas?: Canvas<Graph, NodeElement, EdgeElement>) {
        if (error instanceof QueryTimeoutError) {
            showToast(error.message ?? "Query execution timed out.", "warning");
        } else if (error instanceof QueryValidationError && canvas) {
            const badNodes = error.errorNodes;
            const badEdges = error.errorEdges;
            
            if (badNodes) {
                canvas.getNodes().forEach(node => {
                    if (badNodes.includes(node.getLabelText())) node.showWarning();
                });
            }
            if (badEdges) {
                canvas.getEdges().forEach(edge => {
                    if (badEdges.includes(edge.getLabelText())) edge.showWarning();
                });
            }
            console.error(error);
            showToast(error.message ?? "Query failed.", "error");
        } else if (error instanceof Error) {
            console.error(error);
            showToast(error.message, "error");
        } else {
            console.error(error);
            showToast("An unknown error occurred.", "error");
        }
    }

    async function onQuery() {
        if (!graphDB) {
            showToast("No database connection available.", "error");
            return;
        }

        if (state.mode === ModeType.Multiquery) {
            try {
                const query = await multi.queryFormula();
                console.info("Executing query:", query);
                loading(true);
                const result = await graphDB.query(query, {}, settings.config.queryTimeout);
                saveQueryState(result, query);
                render(result, state.lastQuery);
                tabbar.enableButton(ModeType.Result);
                tabbar.clickButton(ModeType.Result);
                showToast("Query executed successfully.", "success");
            } catch (error: unknown) {
                handleQueryError(error);
            } finally {
                loading(false);
            }
            return;
        }

        if (state.currentCanvas !== queryCanvas) {
            console.warn("Not yet implemented for this mode.");
            return;
        }
        
        state.currentCanvas.getNodes().forEach(node => node.clearWarning());
        state.currentCanvas.getEdges().forEach(edge => edge.clearWarning());
        
        try {
            const queryGraph = state.currentCanvas.getGraph();
            if (!(queryGraph instanceof QueryGraph)) return;
            
            const query = await queryGraph.query();
            console.info("Executing query:", query);
            loading(true);
            const result = await graphDB.query(query, {}, settings.config.queryTimeout);
            console.table(result);
            saveQueryState(result, query);
            render(result, state.lastQuery);
            tabbar.enableButton(ModeType.Result);
            tabbar.clickButton(ModeType.Result);
            showToast("Query executed successfully.", "success");
        } catch (error: unknown) {
            handleQueryError(error, state.currentCanvas);
        } finally {
            loading(false);
        }
    }

    async function onLoad() {
        if (state.mode === ModeType.Multiquery) {
            try {
                const data = await getGraphData();
                const [_, graphData] = data;
                multi.deserialize(graphData, graphDB);
                showToast(`Graphs loaded successfully.`, "success");
            } catch (error: unknown) {
                console.error("Error loading graphs:", error);
                showToast(error instanceof Error ? error.message : "Error loading graphs.", "error");
            }
            return;
        }

        if (!state.currentCanvas) {
            showToast("No active canvas to load graph into.", "error");
            return;
        }

        try {
            const data = await getGraphData();
            const [_, graphData] = data;
            const graph = Graph.deserialize(graphData, graphDB, state.mode, true);
            
            if (state.currentCanvas instanceof ModelCanvas) {
                loading(true);
                await state.currentCanvas.setGraph(graph as ModelGraph);
                autoSave();
            } else {
                state.currentCanvas.setGraph(graph);
            }

            if (graph instanceof ModelGraph && graphDB) { // Debugging
                const tables = await graphDB.getAllTables();
                for (const table of tables) {
                    console.table(table);
                }
            } 

            onChange(true);
            if (state.mode === ModeType.Querying && graphData.mode === ModeType.Modelling) {
                console.warn("Loaded a Modelling graph into Querying mode.");
                showToast("Loaded a Modelling graph into Querying mode.", "warning");
            } else {
                console.info("Graph loaded.");
                showToast("Graph loaded successfully.", "success");
            }
        } catch (error: unknown) {
            console.error("Error loading graph:", error);
            showToast(error instanceof Error ? error.message : "Error loading graph.", "error");
        } finally {
            loading(false);
        }
    }

    async function onSave(silent: boolean = false) {
        if (state.mode !== ModeType.Modelling) return;
        try {
            localStorage.setItem("modelGraph", JSON.stringify(state.currentCanvas?.getGraph().serialize()));
            if (!silent) showToast("Graph saved to local storage.", "success");
            modelCanvas.hasPendingChanges = false;
            tabbar.updateMode(true, ModeType.Modelling);
        } catch (error: unknown) {
            console.error("Error saving graph:", error);
            if (!silent) showToast(error instanceof Error ? error.message : "Error saving graph.", "error");
        }
    }

    async function onDownload() {
        if (state.mode === ModeType.Result) {
            if (!state.lastQueryTable || state.lastQueryTable.length === 0) {
                showToast("No query results to save.", "error");
                return;
            }
            
            const csv = toCsv(state.lastQueryTable);
            const csv_blob = new Blob([csv], { type: "text/csv" });
            const csv_file = new File([csv_blob], "results.csv", { type: "text/csv" });
            
            const cyp_blob = new Blob([state.lastQuery ?? ""], { type: "text/cypher" });
            const cyp_file = new File([cyp_blob], "query.cypher", { type: "text/cypher" });

            const zipFile = await createZipFile([csv_file, cyp_file], "query_results.zip");
            downloadFile(zipFile);
            return;
        }

        if (state.mode === ModeType.Multiquery) {
            if (multi.getGraphs().length === 0) {
                showToast("No graphs to save.", "error");
                return;
            }
            const serializedGraphs = multi.serialize();
            const blob = new Blob([JSON.stringify(serializedGraphs)], { type: "application/json" });
            const file = new File([blob], "multiquery_graphs.json", { type: "application/json" });
            downloadFile(file);
            return;
        }

        if (!state.currentCanvas) return;

        if (state.currentCanvas.getNodes().length === 0) {
            showToast("No graph to save.", "error");
            return;
        }

        const graph = state.currentCanvas.getGraph();
        const serializedGraph = JSON.stringify(graph.serialize());
        const blob = new Blob([serializedGraph], { type: "application/json" });

        const name = () => {
            switch (state.mode) {
                case ModeType.Modelling: return "model_graph.json";
                case ModeType.Querying: return "query_graph.json";
                default: return "graph.json";
            }
        };

        const file = new File([blob], name(), { type: "application/json" });
        downloadFile(file);
        onChange(true);
    }

    function onReset() {
        if (state.mode === ModeType.Multiquery) {
            if (multi.getGraphs().length === 0) return;
            if (!confirm("Are you sure you want to reset all graphs? This will clear all graphs.")) return;
            
            multi.setGraphs([]);
            showToast("All graphs have been reset.", "info");
            return;
        }

        if (!state.currentCanvas || state.currentCanvas.getNodes().length === 0) return;
        if (!confirm("Are you sure you want to reset the graph? This will clear all nodes and edges.")) return;
        
        state.currentCanvas.setGraph(Graph.getGraphObject(state.mode, graphDB));
        showToast("Graph has been reset.", "info");
    }

    async function onAddGraph() {
        try {
            const data = await getMultipleGraphData();
            for (const fileData of data) {
                const [fileName, graphData] = fileData;
                let name = fileName.replace(/\.[^/.]+$/, "");
                name = name.trim().replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
                
                const graph = Graph.deserialize(graphData, graphDB, ModeType.Querying) as QueryGraph;
                multi.addGraph({ id: `query-${crypto.randomUUID()}`, name: name, source: graph });
            }
            showToast(`Graphs added successfully.`, "success");
        } catch (error: unknown) {
            console.error("Error adding graph:", error);
            showToast(error instanceof Error ? error.message : "Error adding graph.", "error");
        }
    }

    async function onInspect(graph: QueryGraph) {
        tabbar.clickButton(ModeType.Querying);
        if (state.currentCanvas !== queryCanvas) {
            console.error("Current canvas is not the query canvas.");
            return;
        }
        state.currentCanvas.setGraph(graph);
        onChange(true);
    }

    function beforeUnload(event: BeforeUnloadEvent) {
        if (canvases.some((canvas) => canvas.hasPendingChanges)) {
            event.preventDefault();
        }
    }

    async function initLoad() {
        try {
            const savedGraph = localStorage.getItem("modelGraph");
            if (savedGraph) {
                loading(true);
                const graphData = JSON.parse(savedGraph);
                const graph = Graph.deserialize(graphData, graphDB, ModeType.Modelling);
                await modelCanvas.setGraph(graph as ModelGraph);
                onChange(true);
                console.info("Loaded saved model graph from local storage.");
            }
        } catch (error: unknown) {
            console.error("Error loading saved model graph:", error);
        } finally {
            loading(false);
        }
    }

    return {
        async init() {
            syncModeUi();
            window.addEventListener("beforeunload", beforeUnload);
            await initLoad();
        },
        destroy() {
            window.removeEventListener("beforeunload", beforeUnload);
            clearTimeout(state.autoSaveTimer);
        }
    };
}
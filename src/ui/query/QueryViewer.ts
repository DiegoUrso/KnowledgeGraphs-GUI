export default class QueryViewer {
    private root: HTMLElement;
    private code: HTMLElement | null = null;
    private details: HTMLDetailsElement | null = null;

    protected tableContainer: HTMLElement;

    constructor(root: HTMLElement) {
        this.root = root;
        this.tableContainer = this.root.querySelector(".query-viewer__table")!;
        this.details = this.root.querySelector(".query-viewer__details");
        this.code = this.root.querySelector(".query-viewer__code")?.querySelector("code")!;
    }

    render(
        table: Record<string, string>[],
        query?: string,
        onRowClick?: (row: Record<string, string>) => void,
        maxRows: number = 100
    ) {
        this.tableContainer.replaceChildren();
        const htmlTable = document.createElement("table");
        if (table.length > 0) {
            const columns = Object.keys(table[0])
            const visibleColumns = columns.filter(col => !col.startsWith("$"));

            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            for (const column of visibleColumns) {
                const th = document.createElement("th");
                th.textContent = column;
                headerRow.appendChild(th);
            }
            thead.appendChild(headerRow);
            htmlTable.appendChild(thead);

            const tbody = document.createElement("tbody");
            for (const row of table) {
                if (tbody.children.length >= maxRows) {
                    const tr = document.createElement("tr");
                    const td = document.createElement("td");
                    td.colSpan = visibleColumns.length;
                    td.textContent = `...and ${table.length - maxRows} more rows`;
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                    break;
                }
                const tr = document.createElement("tr");

                if (onRowClick) {
                    tr.addEventListener("click", () => {
                        onRowClick(row);
                    });
                }

                for (const column of visibleColumns) {
                    const td = document.createElement("td");
                    td.textContent = String(row[column] ?? "");
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            htmlTable.appendChild(tbody);
        } else {
            const caption = document.createElement("caption");
            caption.textContent = "No results";
            htmlTable.appendChild(caption);
        }
        this.tableContainer.appendChild(htmlTable);

        this.renderCode(query);
    }

    renderCode(query?: string) {
        if (this.code && this.details) {
            this.code.textContent = query ?? "";
            this.details.hidden = !query;
        }
    }

    hide() {
        this.root.hidden = true;
    }

    show() {
        this.root.hidden = false;
    }
}

export class FloatingQueryViewer extends QueryViewer {
    private button: HTMLElement;

    constructor(root: HTMLElement) {
        super(root);
        this.button = root.querySelector('.floating-container__button')!;

        this.button.addEventListener('click', () => {
            if (this.tableContainer.hidden) {
                this.open();
            } else {
                this.close();
            }
        });
    }

    open() {
        this.tableContainer.hidden = false;
        this.button.textContent = '—';
    }

    close() {
        this.tableContainer.hidden = true;
        this.button.textContent = '＋';
    }
}
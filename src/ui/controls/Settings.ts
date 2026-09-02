import toast from "@/utils/toast";

export interface AppConfig {
    dbUri: string;
    dbUser: string;
    dbPass: string;
    queryTimeout: number;
    resultLimit: number;
    autoSave: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
    dbUri: "bolt://localhost:7687",
    dbUser: "neo4j",
    dbPass: "password",
    queryTimeout: 5000,
    resultLimit: 250,
    autoSave: true
};

export default class Settings {
    public config: AppConfig;
    private root: HTMLElement;
    private bodyContainer: HTMLElement;

    private inputs!: {
        dbUri: HTMLInputElement;
        dbUser: HTMLInputElement;
        dbPass: HTMLInputElement;
        queryTimeout: HTMLInputElement;
        resultLimit: HTMLInputElement;
        autoSave: HTMLInputElement;
    };
    
    private clearBtn!: HTMLButtonElement;

    constructor(root: HTMLElement) {
        this.root = root;
        this.bodyContainer = root.querySelector(".settings-modal__body") as HTMLElement;
        this.config = this.loadFromStorage();
        this.buildUI();
        this.populateUI();
        this.bindEvents();

        this.root.querySelector(".settings-modal__close-btn")?.addEventListener("click", () => {
            this.hide();
        });
    }

    private loadFromStorage(): AppConfig {
        const stored = localStorage.getItem("app_settings");
        if (stored) {
            try {
                return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
            } catch (e) {
                console.error("Error parsing settings", e);
            }
        }
        return { ...DEFAULT_CONFIG };
    }

    private saveToStorage() {
        localStorage.setItem("app_settings", JSON.stringify(this.config));
    }

    private buildUI() {
        this.inputs = {} as any;
        this.bodyContainer.replaceChildren();

        const dbSection = this.createSection("Database Connection (Refresh to Apply)");
        
        const uriField = this.createInputLabel("URI", "text", "bolt://localhost:7687");
        this.inputs.dbUri = uriField.input;
        dbSection.appendChild(uriField.label);

        const userField = this.createInputLabel("Username", "text", "neo4j");
        this.inputs.dbUser = userField.input;
        dbSection.appendChild(userField.label);

        const passField = this.createInputLabel("Password", "password");
        this.inputs.dbPass = passField.input;
        dbSection.appendChild(passField.label);

        this.bodyContainer.appendChild(dbSection);

        const limitsSection = this.createSection("Query & Execution Limits");
        
        const timeoutField = this.createInputLabel("Query Timeout (ms)", "number");
        this.inputs.queryTimeout = timeoutField.input;
        timeoutField.input.min = "1000";
        timeoutField.input.step = "1000";
        limitsSection.appendChild(timeoutField.label);

        const limitField = this.createInputLabel("Visual Result Limit", "number");
        this.inputs.resultLimit = limitField.input;
        limitField.input.min = "1";
        limitsSection.appendChild(limitField.label);

        this.bodyContainer.appendChild(limitsSection);

        const storageSection = this.createSection("Storage & Application State");
        
        const autoSaveLabel = document.createElement("label");
        autoSaveLabel.className = "settings-checkbox";
        const autoSaveInput = document.createElement("input");
        autoSaveInput.type = "checkbox";
        autoSaveLabel.appendChild(autoSaveInput);
        autoSaveLabel.appendChild(document.createTextNode(" Enable Canvas Auto-save"));
        this.inputs.autoSave = autoSaveInput;
        storageSection.appendChild(autoSaveLabel);

        this.clearBtn = document.createElement("button");
        this.clearBtn.className = "multi__button multi__button--danger";
        this.clearBtn.textContent = "Clear Local Storage";
        this.clearBtn.style.marginTop = "0.5rem";
        storageSection.appendChild(this.clearBtn);

        this.bodyContainer.appendChild(storageSection);
    }

    private createSection(title: string): HTMLDivElement {
        const section = document.createElement("div");
        section.className = "settings-section";
        const h3 = document.createElement("h3");
        h3.textContent = title;
        section.appendChild(h3);
        return section;
    }

    private createInputLabel(labelText: string, type: string, placeholder: string = ""): { label: HTMLLabelElement, input: HTMLInputElement } {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = type;
        input.className = "multi__input";
        if (placeholder) input.placeholder = placeholder;
        
        label.appendChild(input);
        return { label, input };
    }

    private populateUI() {
        this.inputs.dbUri.value = this.config.dbUri;
        this.inputs.dbUser.value = this.config.dbUser;
        this.inputs.dbPass.value = this.config.dbPass;
        this.inputs.queryTimeout.value = this.config.queryTimeout.toString();
        this.inputs.resultLimit.value = this.config.resultLimit.toString();
        this.inputs.autoSave.checked = this.config.autoSave;
    }

    private bindEvents() {
        const textInputs = ['dbUri', 'dbUser', 'dbPass'] as const;
        textInputs.forEach(key => {
            this.inputs[key].addEventListener("input", (e) => {
                this.config[key] = (e.target as HTMLInputElement).value;
                this.saveToStorage();
            });
        });

        const numInputs = ['queryTimeout', 'resultLimit'] as const;
        numInputs.forEach(key => {
            this.inputs[key].addEventListener("input", (e) => {
                this.config[key] = parseInt((e.target as HTMLInputElement).value, 10) || DEFAULT_CONFIG[key];
                this.saveToStorage();
            });
        });

        this.inputs.autoSave.addEventListener("change", (e) => {
            this.config.autoSave = (e.target as HTMLInputElement).checked;
            this.saveToStorage();
        });

        this.clearBtn.addEventListener("click", () => {
            if (confirm("Are you sure you want to clear all local data? This will delete your settings and saved canvas graphs.")) {
                localStorage.clear();
                this.config = { ...DEFAULT_CONFIG };
                this.populateUI();
                toast("Local storage cleared.", "info");
            }
        });
    }

    hide() {
        this.root.hidden = true;
    }

    show() {
        this.root.hidden = false;
    }
}

export function getSetting(key: keyof AppConfig): any {
    const stored = localStorage.getItem("app_settings");
    if (stored) {
        try {
            const config = JSON.parse(stored);
            return config[key];
        } catch (e) {
            console.error("Error parsing settings", e);
        }
    }
    return DEFAULT_CONFIG[key];
}
export const ModeType = {
    Modelling: "Modelling",
    Querying: "Querying",
    Multiquery: "Multiquery",
    Result: "Query Result"
}
export type ModeType = typeof ModeType[keyof typeof ModeType];

export default class Tabbar {
    private currentMode: ModeType = ModeType.Modelling;
    private onModeChanged: (mode: ModeType) => void;
    private onSettingsClicked: () => void;

    private readonly buttons: HTMLButtonElement[] = [];

    private hasEnabledResultButton: boolean = false;

    constructor(
        onModeChanged: (mode: ModeType) => void,
        onSettingsClicked: () => void
    ) {
        this.onModeChanged = onModeChanged;
        this.onSettingsClicked = onSettingsClicked;
        this.createModebar();
    }

    updateMode(isSaved: boolean, mode?: ModeType) {
        const currentButton = this.buttons.find(button => button.name === (mode ?? this.currentMode));
        currentButton?.classList.toggle("unsaved", !isSaved);
    }

    clickButton(mode: ModeType) {
        const button = this.buttons.find(b => b.name === mode);
        if (button) {
            button.click();
        }
    }

    enableButton(mode: ModeType) {
        const button = this.buttons.find(b => b.name === mode);
        if (button) {
            button.disabled = false;
        }
        if (mode === ModeType.Result) {
            this.hasEnabledResultButton = true;
        }
    }

    freeze() {
        this.buttons.forEach(button => {
            button.disabled = true;
        });
    }

    unfreeze() {
        if (this.hasEnabledResultButton) {
            this.buttons.forEach(button => {
                button.disabled = false;
            });
        } else {
            this.buttons.forEach(button => {
                if (button.name !== ModeType.Result) {
                    button.disabled = false;
                }
            });
        }
    }

    private createModebar() {
        const tabbar = document.querySelector(".menu__tabbar") as HTMLDivElement;

        const modellingButton = this.createButton(ModeType.Modelling);
        modellingButton.classList.add("selected");
        const queryingButton = this.createButton(ModeType.Querying);
        const multiqueryButton = this.createButton(ModeType.Multiquery);
        const resultButton = this.createButton(ModeType.Result);
        resultButton.disabled = true;

        this.buttons.push(modellingButton, queryingButton, multiqueryButton, resultButton);
        this.buttons.forEach(button => tabbar.appendChild(button));

        const spacer = document.createElement("div");
        spacer.className = "spacer";
        const settingsButton = this.createSettingsButton();
        tabbar.appendChild(spacer);
        tabbar.appendChild(settingsButton);
    }

    private createButton(mode: ModeType, text?: string): HTMLButtonElement {
        const button = document.createElement("button");
        button.classList.add("menu__tab");
        button.name = mode;
        button.textContent = text ?? mode;
        button.onclick = () => {
            this.currentMode = mode;
            this.onModeChanged(this.currentMode);
            button.classList.add("selected");
            this.buttons.forEach(b => {
                if (b !== button) {
                    b.classList.remove("selected");
                }
            });
            console.debug(`${mode} mode selected`);
        };
        return button;
    }

    private createSettingsButton(): HTMLButtonElement {
        const button = document.createElement("button");
        button.classList.add("menu__settings");
        button.name = "Settings";
        button.textContent = "⚙";
        button.onclick = () => {
            this.onSettingsClicked();
        };
        return button;
    }
}
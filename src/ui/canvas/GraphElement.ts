import Konva from "konva";
import type { Context } from "@/ui/canvas/ContextMenu";

export default abstract class GraphElement extends Konva.Group {
    abstract context: Context[];
    abstract selected: boolean;

    abstract label: Konva.Text;

    protected abstract centerLabel(): void;
    abstract toggleSelected(): void;
    
    getLabelText(): string {
        return this.label.text().replaceAll("?", "");
    }

    setLabelText(text: string, format: boolean = false) {
        text = text.replaceAll("?", "").trim();
        const formattedText = format ? text.replaceAll("|", "").replaceAll("*", "").replaceAll("^", "").replaceAll(" ", "_") : text;
        this.label.text(formattedText);
        this.centerLabel();
    }

    editLabel(onChange: (isSaved: boolean) => void, format: boolean = false) {
        const stage = this.getStage() as Konva.Stage;
        this.label.hide();

        const input = document.createElement("input");
        document.body.appendChild(input);

        const stageBox = stage.container().getBoundingClientRect();

        input.value = this.getLabelText();
        input.style.position = "absolute";
        const transform = this.label.getAbsoluteTransform().copy();
        const pos = transform.point({ x: 0, y: 0 });
        input.style.left = `${stageBox.left + pos.x}px`;
        input.style.top = `${stageBox.top + pos.y}px`;
        input.style.width = `${Math.max(this.label.width(), 80)}px`;
        input.focus();
        input.select();

        const finish = (change: boolean) => {
            if (change) {
                const newText = input.value.trim();
                if (newText !== this.getLabelText()) {
                    onChange(false);
                } 
                this.setLabelText(newText, format);
            }
            this.label.show();
            input.remove();
        }

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                finish(true);
            }
            if (e.key === "Escape") {
                finish(false);
            }
        });

        input.addEventListener("blur", () => finish(true));
    }
}
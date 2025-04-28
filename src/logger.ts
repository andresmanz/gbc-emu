export class Logger {
    public readonly lines: string[] = [];

    constructor(public maxLines = 20) {}

    log(text: string) {
        this.lines.push(text);

        /*
        if (this.lines.length > this.maxLines) {
            this.lines.splice(0, 1);
        }
        */
    }
}

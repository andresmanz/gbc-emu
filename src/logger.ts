export class Logger {
    public lines: string[] = [];

    constructor(private maxLines = 100000) {}

    log(text: string) {
        /*
        this.lines.push(text);

        if (this.lines.length > this.maxLines) {
            this.lines.splice(0, this.maxLines / 10);
        }
        */
    }
}

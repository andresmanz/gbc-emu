export class Logger {
    public readonly lines: string[] = [];

    log(text: string) {
        this.lines.push(text);
    }
}

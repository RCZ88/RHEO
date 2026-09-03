declare module "*.md?raw" {
	const content: string
	export default content
}

declare module 'node-pty' {
    export interface IPty {
        onData(callback: (data: string) => void): void;
        onExit(callback: (exit: { exitCode: number; signal: number }) => void): void;
        write(data: string): void;
        resize(cols: number, rows: number): void;
        kill(signal?: string): void;
    }

    export interface spawnOptions {
        name?: string;
        cols?: number;
        rows?: number;
        cwd?: string;
        env?: Record<string, string>;
    }

    export function spawn(
        command: string,
        args?: string[],
        options?: spawnOptions
    ): IPty;
}